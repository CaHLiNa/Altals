import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { nanoid } from './utils'
import { useWorkspaceStore } from './workspace'

let _saveTimer = null
const SAVE_DEBOUNCE = 1000

export const useCommentsStore = defineStore('comments', () => {
  // ─── State ────────────────────────────────────────────────────────
  const comments = ref([])
  const activeCommentId = ref(null)
  const marginVisible = ref({})
  const showResolved = ref(false)
  const editStatuses = ref({}) // "commentId:replyId" → { status, error? }

  // ─── Getters ──────────────────────────────────────────────────────
  function commentsForFile(filePath) {
    return comments.value
      .filter(c => c.filePath === filePath)
      .sort((a, b) => a.range.from - b.range.from)
  }

  function unresolvedForFile(filePath) {
    return comments.value
      .filter(c => c.filePath === filePath && c.status === 'active')
      .sort((a, b) => a.range.from - b.range.from)
  }

  function unresolvedCount(filePath) {
    return comments.value.filter(c => c.filePath === filePath && c.status === 'active').length
  }

  const activeComment = computed(() =>
    comments.value.find(c => c.id === activeCommentId.value) || null
  )

  // ─── Actions ──────────────────────────────────────────────────────

  function createComment(filePath, range, anchorText, text, author = 'user', fileRefs = null, proposedEdit = null) {
    const now = new Date().toISOString()
    const comment = {
      id: `comment-${nanoid()}`,
      filePath,
      range: { from: range.from, to: range.to },
      anchorText,
      author,
      text,
      replies: [],
      proposedEdit: proposedEdit || null,
      status: 'active',
      fileRefs: fileRefs || null,
      createdAt: now,
      updatedAt: now,
    }
    comments.value.push(comment)
    _save()
    return comment
  }

  function addReply(commentId, { author, text, proposedEdit = null, fileRefs = null }) {
    const comment = comments.value.find(c => c.id === commentId)
    if (!comment) return

    const reply = {
      id: `reply-${nanoid()}`,
      author,
      text,
      proposedEdit: proposedEdit || null,
      fileRefs: fileRefs || null,
      timestamp: new Date().toISOString(),
    }
    comment.replies.push(reply)
    comment.updatedAt = new Date().toISOString()
    _save()
    return reply
  }

  function resolveComment(commentId) {
    const comment = comments.value.find(c => c.id === commentId)
    if (!comment) return
    comment.status = 'resolved'
    comment.updatedAt = new Date().toISOString()
    if (activeCommentId.value === commentId) {
      activeCommentId.value = null
    }
    _save()
  }

  function unresolveComment(commentId) {
    const comment = comments.value.find(c => c.id === commentId)
    if (!comment) return
    comment.status = 'active'
    comment.updatedAt = new Date().toISOString()
    _save()
  }

  function deleteComment(commentId) {
    const idx = comments.value.findIndex(c => c.id === commentId)
    if (idx === -1) return
    comments.value.splice(idx, 1)
    if (activeCommentId.value === commentId) {
      activeCommentId.value = null
    }
    _save()
  }

  function updateRange(commentId, from, to) {
    const comment = comments.value.find(c => c.id === commentId)
    if (!comment) return
    comment.range = { from, to }
    _debouncedSave()
  }

  function setActiveComment(commentId) {
    activeCommentId.value = commentId
  }

  function isMarginVisible(filePath) {
    if (filePath in marginVisible.value) return marginVisible.value[filePath]
    return commentsForFile(filePath).length > 0
  }

  function toggleMargin(filePath) {
    if (!filePath) return
    marginVisible.value[filePath] = !isMarginVisible(filePath)
  }

  function getEditStatus(commentId, replyId = null) {
    const key = replyId ? `${commentId}:${replyId}` : `${commentId}:`
    return editStatuses.value[key] || null
  }

  // ─── Persistence ──────────────────────────────────────────────────

  async function _save() {
    const workspace = useWorkspaceStore()
    if (!workspace.shouldersDir) return

    try {
      await invoke('write_file', {
        path: `${workspace.shouldersDir}/comments.json`,
        content: JSON.stringify(comments.value, null, 2),
      })
    } catch (e) {
      console.warn('Failed to save comments:', e)
    }
  }

  async function saveComments() {
    await _save()
  }

  function _debouncedSave() {
    if (_saveTimer) clearTimeout(_saveTimer)
    _saveTimer = setTimeout(() => {
      _saveTimer = null
      _save()
    }, SAVE_DEBOUNCE)
  }

  async function loadComments() {
    const workspace = useWorkspaceStore()
    if (!workspace.shouldersDir) return

    comments.value = []
    activeCommentId.value = null
    editStatuses.value = {}

    const filePath = `${workspace.shouldersDir}/comments.json`
    try {
      const exists = await invoke('path_exists', { path: filePath })
      if (!exists) return

      const content = await invoke('read_file', { path: filePath })
      const data = JSON.parse(content)
      if (!Array.isArray(data)) return

      comments.value = data
    } catch (e) {
      console.warn('Failed to load comments:', e)
    }
  }

  function cleanup() {
    if (_saveTimer) {
      clearTimeout(_saveTimer)
      _saveTimer = null
    }
    comments.value = []
    activeCommentId.value = null
    marginVisible.value = {}
    showResolved.value = false
    editStatuses.value = {}
  }

  // ─── Public API ─────────────────────────────────────────────────
  return {
    // State
    comments,
    activeCommentId,
    isMarginVisible,
    showResolved,
    editStatuses,

    // Getters
    commentsForFile,
    unresolvedForFile,
    unresolvedCount,
    activeComment,

    // Actions
    createComment,
    addReply,
    resolveComment,
    unresolveComment,
    deleteComment,
    updateRange,
    setActiveComment,
    toggleMargin,
    getEditStatus,

    // Persistence
    saveComments,
    loadComments,
    cleanup,
  }
})
