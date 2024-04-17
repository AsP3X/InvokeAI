import { ButtonGroup, IconButton } from '@invoke-ai/ui-library';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { toolChanged } from 'features/regionalPrompts/store/regionalPromptsSlice';
import { useCallback } from 'react';
import { PiArrowsOutCardinalBold, PiEraserBold, PiPaintBrushBold } from 'react-icons/pi';

export const ToolChooser: React.FC = () => {
  const tool = useAppSelector((s) => s.regionalPrompts.tool);
  const dispatch = useAppDispatch();
  const setToolToBrush = useCallback(() => {
    dispatch(toolChanged('brush'));
  }, [dispatch]);
  const setToolToEraser = useCallback(() => {
    dispatch(toolChanged('eraser'));
  }, [dispatch]);
  const setToolToMove = useCallback(() => {
    dispatch(toolChanged('move'));
  }, [dispatch]);

  return (
    <ButtonGroup isAttached>
      <IconButton
        aria-label="Brush tool"
        icon={<PiPaintBrushBold />}
        variant={tool === 'brush' ? 'solid' : 'outline'}
        onClick={setToolToBrush}
      />
      <IconButton
        aria-label="Eraser tool"
        icon={<PiEraserBold />}
        variant={tool === 'eraser' ? 'solid' : 'outline'}
        onClick={setToolToEraser}
      />
      <IconButton
        aria-label="Move tool"
        icon={<PiArrowsOutCardinalBold />}
        variant={tool === 'move' ? 'solid' : 'outline'}
        onClick={setToolToMove}
      />
    </ButtonGroup>
  );
};