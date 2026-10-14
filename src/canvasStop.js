const activeStatuses = new Set(['running', 'generating', 'planning', 'revising', 'compiling', 'reviewing', 'reviewing-sequence', 'uploading', 'compiling-characters', 'queued']);
export function activeCanvasNodes(nodes, activeRunIds = []) {
  const ids = new Set(activeRunIds);
  return nodes.filter(node => ids.has(node.id) || activeStatuses.has(node.data?.status) || node.data?.characterVoiceBusy || node.data?.seedanceFinishing || node.data?.storyboardRevisionActive);
}
export function stoppedCanvasNodePatch(node, message) {
  return { status: 'error', error: message, exploreStopRequested: true, characterVoiceBusy: false, seedanceFinishing: '', storyboardRevisionActive: false,
    ...(node.type === 'storyboard' ? { storyboardCharacters: (node.data.storyboardCharacters || []).map(character => activeStatuses.has(character.status) ? { ...character, status: 'error', error: message } : character), storyboardFrames: (node.data.storyboardFrames || []).map(frame => activeStatuses.has(frame.status) || frame.status === 'queued' ? { ...frame, status: 'error', error: message } : frame) } : {}) };
}
