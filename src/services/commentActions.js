import { invoke } from '@tauri-apps/api/core'
import { useCommentsStore } from '../stores/comments'
import { useEditorStore } from '../stores/editor'
import { useFilesStore } from '../stores/files'

function getEditStatusKey(commentId, replyId = null) {
  return replyId ? `${commentId}:${replyId}` : `${commentId}:`
}

function getProposedEdit(comment, replyId = null) {
  if (!comment) return null
  if (!replyId) return comment.proposedEdit || null
  const reply = (comment.replies || []).find((item) => item.id === replyId)
  return reply?.proposedEdit || null
}

export async function applyCommentProposedEdit(commentId, replyId = null) {
  const commentsStore = useCommentsStore()
  const filesStore = useFilesStore()
  const editorStore = useEditorStore()
  const comment = commentsStore.comments.find((item) => item.id === commentId)
  if (!comment) return

  const statusKey = getEditStatusKey(commentId, replyId)
  if (commentsStore.editStatuses[statusKey]?.status === 'applied') return

  const proposedEdit = getProposedEdit(comment, replyId)
  if (!proposedEdit?.oldText || !proposedEdit?.newText) {
    commentsStore.editStatuses[statusKey] = {
      status: 'error',
      error: 'No proposed edit found.',
    }
    return
  }

  try {
    commentsStore.editStatuses[statusKey] = { status: 'pending' }

    const currentContent = await invoke('read_file', { path: comment.filePath })
    const rawFrom = Number(comment.range?.from)
    const rawTo = Number(comment.range?.to)
    const from = Number.isFinite(rawFrom) ? Math.max(0, Math.min(rawFrom, currentContent.length)) : 0
    const to = Number.isFinite(rawTo) ? Math.max(from, Math.min(rawTo, currentContent.length)) : from
    const anchorSlice = currentContent.slice(from, to)
    const localIdx = anchorSlice.indexOf(proposedEdit.oldText)

    if (localIdx === -1) {
      commentsStore.editStatuses[statusKey] = {
        status: 'error',
        error: 'oldText was not found inside the anchored comment range. The document likely changed and the suggestion must be re-anchored.',
      }
      return
    }

    const editStart = from + localIdx
    const editEnd = editStart + proposedEdit.oldText.length
    const newContent = currentContent.slice(0, editStart) + proposedEdit.newText + currentContent.slice(editEnd)
    await invoke('write_file', { path: comment.filePath, content: newContent })

    filesStore.fileContents[comment.filePath] = newContent
    editorStore.openFile(comment.filePath)

    comment.range = { from: editStart, to: editStart + proposedEdit.newText.length }
    comment.updatedAt = new Date().toISOString()
    commentsStore.editStatuses[statusKey] = { status: 'applied' }
    await commentsStore.saveComments()
  } catch (error) {
    commentsStore.editStatuses[statusKey] = {
      status: 'error',
      error: `Error applying edit: ${error}`,
    }
  }
}
