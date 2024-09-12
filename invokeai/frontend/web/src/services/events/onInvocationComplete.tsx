import { Button } from '@invoke-ai/ui-library';
import { logger } from 'app/logging/logger';
import type { AppDispatch, RootState } from 'app/store/store';
import { useAppDispatch } from 'app/store/storeHooks';
import type { SerializableObject } from 'common/types';
import { deepClone } from 'common/util/deepClone';
import { stagingAreaImageStaged } from 'features/controlLayers/store/canvasStagingAreaSlice';
import { $imageViewerState } from 'features/gallery/components/ImageViewer/useImageViewer';
import { boardIdSelected, galleryViewChanged, imageSelected, offsetChanged } from 'features/gallery/store/gallerySlice';
import { $nodeExecutionStates, upsertExecutionState } from 'features/nodes/hooks/useExecutionState';
import { zNodeStatus } from 'features/nodes/types/invocation';
import { selectShowSendToToasts, showSendToToastsChanged } from 'features/system/store/systemSlice';
import { toast } from 'features/toast/toast';
import { selectActiveTab } from 'features/ui/store/uiSelectors';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { boardsApi } from 'services/api/endpoints/boards';
import { getImageDTO, imagesApi } from 'services/api/endpoints/images';
import type { ImageDTO, S } from 'services/api/types';
import { getCategories, getListImagesUrl } from 'services/api/util';

const log = logger('events');

const isCanvasOutputNode = (data: S['InvocationCompleteEvent']) => {
  return data.invocation_source_id.split(':')[0] === 'canvas_output';
};

const SEND_TO_TOAST_ID = 'send-to-toast';

const DontShowMeTheseToastDescription = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const onClick = useCallback(() => {
    dispatch(showSendToToastsChanged(false));
  }, [dispatch]);

  return (
    <Button onClick={onClick} size="sm" variant="link" color="base.50">
      {t('common.dontShowMeThese')}
    </Button>
  );
};

export const buildOnInvocationComplete = (
  getState: () => RootState,
  dispatch: AppDispatch,
  nodeTypeDenylist: string[],
  setLastProgressEvent: (event: S['InvocationDenoiseProgressEvent'] | null) => void,
  setLastCanvasProgressEvent: (event: S['InvocationDenoiseProgressEvent'] | null) => void
) => {
  const toastIfUserIsLost = (destination: string | null) => {
    const state = getState();
    const showToasts = selectShowSendToToasts(state);
    if (!showToasts) {
      return;
    }
    const tab = selectActiveTab(state);
    if (destination === 'canvas' && ($imageViewerState.get() || tab !== 'generation')) {
      toast({
        id: SEND_TO_TOAST_ID,
        title: 'Image sent to Canvas',
        updateDescription: true,
        withCount: false,
        description: <DontShowMeTheseToastDescription />,
      });
    } else if (destination !== 'canvas' && !$imageViewerState.get() && tab === 'generation') {
      toast({
        id: SEND_TO_TOAST_ID,
        title: 'Image sent to Gallery',
        updateDescription: true,
        withCount: false,
        description: <DontShowMeTheseToastDescription />,
      });
    }
  };

  const addImageToGallery = (imageDTO: ImageDTO) => {
    if (imageDTO.is_intermediate) {
      return;
    }

    // update the total images for the board
    dispatch(
      boardsApi.util.updateQueryData('getBoardImagesTotal', imageDTO.board_id ?? 'none', (draft) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        draft.total += 1;
      })
    );

    dispatch(
      imagesApi.util.invalidateTags([
        { type: 'Board', id: imageDTO.board_id ?? 'none' },
        {
          type: 'ImageList',
          id: getListImagesUrl({
            board_id: imageDTO.board_id ?? 'none',
            categories: getCategories(imageDTO),
          }),
        },
      ])
    );

    const { shouldAutoSwitch, galleryView, selectedBoardId } = getState().gallery;

    // If auto-switch is enabled, select the new image
    if (shouldAutoSwitch) {
      // if auto-add is enabled, switch the gallery view and board if needed as the image comes in
      if (galleryView !== 'images') {
        dispatch(galleryViewChanged('images'));
      }

      if (imageDTO.board_id && imageDTO.board_id !== selectedBoardId) {
        dispatch(
          boardIdSelected({
            boardId: imageDTO.board_id,
            selectedImageName: imageDTO.image_name,
          })
        );
      }

      dispatch(offsetChanged({ offset: 0 }));

      if (!imageDTO.board_id && selectedBoardId !== 'none') {
        dispatch(
          boardIdSelected({
            boardId: 'none',
            selectedImageName: imageDTO.image_name,
          })
        );
      }

      dispatch(imageSelected(imageDTO));
    }
  };

  const getResultImageDTO = (data: S['InvocationCompleteEvent']) => {
    const { result } = data;
    if (result.type === 'image_output') {
      return getImageDTO(result.image.image_name);
    } else if (result.type === 'canvas_v2_mask_and_crop_output') {
      return getImageDTO(result.image.image_name);
    }
    return null;
  };

  const handleOriginWorkflows = async (data: S['InvocationCompleteEvent']) => {
    const { result, invocation_source_id } = data;

    const nes = deepClone($nodeExecutionStates.get()[invocation_source_id]);
    if (nes) {
      nes.status = zNodeStatus.enum.COMPLETED;
      if (nes.progress !== null) {
        nes.progress = 1;
      }
      nes.outputs.push(result);
      upsertExecutionState(nes.nodeId, nes);
    }

    const imageDTO = await getResultImageDTO(data);

    if (imageDTO && !imageDTO.is_intermediate) {
      addImageToGallery(imageDTO);
      toastIfUserIsLost(data.destination);
    }
  };

  const handleOriginGeneration = async (data: S['InvocationCompleteEvent']) => {
    const imageDTO = await getResultImageDTO(data);

    if (!imageDTO) {
      return;
    }

    if (data.destination === 'canvas') {
      if (isCanvasOutputNode(data)) {
        if (data.result.type === 'canvas_v2_mask_and_crop_output') {
          const { offset_x, offset_y } = data.result;
          dispatch(stagingAreaImageStaged({ stagingAreaImage: { imageDTO, offsetX: offset_x, offsetY: offset_y } }));
        } else if (data.result.type === 'image_output') {
          dispatch(stagingAreaImageStaged({ stagingAreaImage: { imageDTO, offsetX: 0, offsetY: 0 } }));
        }
        addImageToGallery(imageDTO);
        toastIfUserIsLost(data.destination);
      }
    } else if (!imageDTO.is_intermediate) {
      // session.mode === 'generate'
      setLastCanvasProgressEvent(null);
      addImageToGallery(imageDTO);
      toastIfUserIsLost(data.destination);
    }
  };

  const handleOriginOther = async (data: S['InvocationCompleteEvent']) => {
    const imageDTO = await getResultImageDTO(data);

    if (imageDTO && !imageDTO.is_intermediate) {
      addImageToGallery(imageDTO);
      toastIfUserIsLost(data.destination);
    }
  };

  return async (data: S['InvocationCompleteEvent']) => {
    log.debug(
      { data } as SerializableObject,
      `Invocation complete (${data.invocation.type}, ${data.invocation_source_id})`
    );

    // Update the node execution states - the image output is handled below
    if (data.origin === 'workflows') {
      await handleOriginWorkflows(data);
    } else if (data.origin === 'generation') {
      await handleOriginGeneration(data);
    } else {
      await handleOriginOther(data);
    }

    setLastProgressEvent(null);
  };
};