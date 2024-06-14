import { IconButton, Menu, MenuButton, MenuDivider, MenuItem, MenuList } from '@invoke-ai/ui-library';
import { useAppDispatch } from 'app/store/storeHooks';
import { stopPropagation } from 'common/util/stopPropagation';
import { LayerMenuArrangeActions } from 'features/controlLayers/components/LayerCommon/LayerMenuArrangeActions';
import { LayerMenuRGActions } from 'features/controlLayers/components/LayerCommon/LayerMenuRGActions';
import { useLayerType } from 'features/controlLayers/hooks/layerStateHooks';
import { layerDeleted, layerReset } from 'features/controlLayers/store/controlLayersSlice';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiArrowCounterClockwiseBold, PiDotsThreeVerticalBold, PiTrashSimpleBold } from 'react-icons/pi';

type Props = { layerId: string };

export const EntityMenu = memo(({ layerId }: Props) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const layerType = useLayerType(layerId);
  const resetLayer = useCallback(() => {
    dispatch(layerReset(layerId));
  }, [dispatch, layerId]);
  const deleteLayer = useCallback(() => {
    dispatch(layerDeleted(layerId));
  }, [dispatch, layerId]);
  const shouldShowArrangeActions = useMemo(() => {
    return (
      layerType === 'regional_guidance_layer' ||
      layerType === 'control_adapter_layer' ||
      layerType === 'initial_image_layer' ||
      layerType === 'raster_layer'
    );
  }, [layerType]);
  const shouldShowResetAction = useMemo(() => {
    return layerType === 'regional_guidance_layer' || layerType === 'raster_layer';
  }, [layerType]);

  return (
    <Menu>
      <MenuButton
        as={IconButton}
        aria-label="Layer menu"
        size="sm"
        icon={<PiDotsThreeVerticalBold />}
        onDoubleClick={stopPropagation} // double click expands the layer
      />
      <MenuList>
        {layerType === 'regional_guidance_layer' && (
          <>
            <LayerMenuRGActions layerId={layerId} />
            <MenuDivider />
          </>
        )}
        {shouldShowArrangeActions && (
          <>
            <LayerMenuArrangeActions layerId={layerId} />
            <MenuDivider />
          </>
        )}
        {shouldShowResetAction && (
          <MenuItem onClick={resetLayer} icon={<PiArrowCounterClockwiseBold />}>
            {t('accessibility.reset')}
          </MenuItem>
        )}
        <MenuItem onClick={deleteLayer} icon={<PiTrashSimpleBold />} color="error.300">
          {t('common.delete')}
        </MenuItem>
      </MenuList>
    </Menu>
  );
});

EntityMenu.displayName = 'EntityMenu';