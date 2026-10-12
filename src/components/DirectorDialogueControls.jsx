import React from "react";

export function DirectorDialogueControls({ node, incoming, onChange, disabled }) {
  const rows = Array.isArray(node.data.directorDialogue) ? node.data.directorDialogue : [];
  const characters = (incoming.characterIn || []).map(({ source }) => source);
  const patch = (id, values) => onChange(rows.map(row => row.id === id ? { ...row, ...values } : row));
  return <details className="director-dialogue-controls nodrag nowheel" open={rows.length > 0 ? true : undefined}>
    <summary>Dialogue and character voices</summary>
    <small>Each line uses its Character's selected ElevenLabs voice. Lines play in order with the requested pauses.</small>
    {rows.map((row, index) => <div className="director-dialogue-line" key={row.id}>
      <label>Speaker<select aria-label={`Dialogue line ${index + 1} character`} value={row.characterNodeId || ""} disabled={disabled} onChange={event => patch(row.id, { characterNodeId: event.target.value })}>
        <option value="">Choose a connected Character</option>
        {row.characterNodeId && !characters.some(character => character.id === row.characterNodeId) && <option value={row.characterNodeId}>Disconnected character</option>}
        {characters.map(character => <option key={character.id} value={character.id}>{character.data.characterName || character.data.title} — {character.data.characterVoiceProvider === "elevenlabs" ? character.data.characterElevenLabsVoiceName || "Choose voice" : "Choose ElevenLabs voice"}</option>)}
      </select></label>
      <textarea aria-label={`Dialogue line ${index + 1} text`} placeholder="Exact words this character says" value={row.text || ""} maxLength={1000} disabled={disabled} onChange={event => patch(row.id, { text: event.target.value })} />
      <label>Pause after (s)<input aria-label={`Dialogue line ${index + 1} pause`} type="number" min="0" max="3" step="0.1" value={row.pauseAfter ?? 0.3} disabled={disabled} onChange={event => patch(row.id, { pauseAfter: Number(event.target.value) })} /></label>
      <button type="button" aria-label={`Remove dialogue line ${index + 1}`} disabled={disabled} onClick={() => onChange(rows.filter(item => item.id !== row.id))}>Remove</button>
    </div>)}
    <button type="button" disabled={disabled || rows.length >= 24 || !characters.length} onClick={() => onChange([...rows, { id: crypto.randomUUID(), characterNodeId: characters.length === 1 ? characters[0].id : "", text: "", pauseAfter: 0.3 }])}>Add dialogue line</button>
    {rows.length > 0 && <button type="button" disabled={disabled} onClick={() => onChange(rows, Date.now())} title="Explicitly request new speech on the next Video Run; otherwise saved speech is reused">Regenerate dialogue audio on next run</button>}
  </details>;
}
