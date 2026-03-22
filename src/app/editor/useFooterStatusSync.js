export function useFooterStatusSync({ footerRef, editorStore }) {
  function onCursorChange(pos) {
    footerRef.value?.setCursorPos(pos)
    if (pos.offset != null) editorStore.cursorOffset = pos.offset
  }

  function onEditorStats(stats) {
    footerRef.value?.setEditorStats(stats)
  }

  return {
    onCursorChange,
    onEditorStats,
  }
}
