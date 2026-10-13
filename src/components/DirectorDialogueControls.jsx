import React from "react";
import { Plus, RefreshCw, X } from "lucide-react";

export function DirectorDialogueControls({ node, incoming, onChange, disabled, manual = false, voices = [] }) {
  const rows = Array.isArray(node.data.directorDialogue) ? node.data.directorDialogue : [];
  const characters = (incoming.characterIn || []).map(({ source }) => source);
  const patch = (id, values) => onChange(rows.map(row => row.id === id ? { ...row, ...values } : row));
  return <details className="director-dialogue-controls nodrag nowheel" open={rows.length > 0 ? true : undefined}>
    <summary>Dialogue and character voices</summary>
    {rows.map((row, index) => <div className="director-dialogue-line" key={row.id}>
      <label className="node-row"><span className="node-row-label">Speaker</span><select aria-label={`Dialogue line ${index + 1} character`} value={row.characterNodeId || ""} disabled={disabled} onChange={event => patch(row.id, { characterNodeId: event.target.value })}>
        <option value="">{manual ? "Manual speaker" : "Choose a connected Character"}</option>
        {row.characterNodeId && !characters.some(character => character.id === row.characterNodeId) && <option value={row.characterNodeId}>Disconnected character</option>}
        {characters.map(character => <option key={character.id} value={character.id}>{character.data.characterName || character.data.title} — {character.data.characterVoiceProvider === "elevenlabs" ? character.data.characterElevenLabsVoiceName || "Choose voice" : "Choose ElevenLabs voice"}</option>)}
      </select></label>
      {manual && !row.characterNodeId && <>
        <label className="node-row"><span className="node-row-label">Name</span><input aria-label={`Dialogue line ${index + 1} speaker name`} value={row.speakerName || ""} disabled={disabled} onChange={event => patch(row.id, { speakerName: event.target.value })} /></label>
        <label className="node-row"><span className="node-row-label">Voice</span><select aria-label={`Dialogue line ${index + 1} voice`} value={row.voiceId || ""} disabled={disabled} onChange={event => { const voice = voices.find(item => item.id === event.target.value); patch(row.id, { voiceId: voice?.id || "", voiceName: voice?.name || "" }); }}><option value="">Choose voice</option>{row.voiceId && !voices.some(voice => voice.id === row.voiceId) && <option value={row.voiceId}>{row.voiceName || row.voiceId}</option>}{voices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
      </>}
      <label className="node-row"><span className="node-row-label">Line</span><textarea aria-label={`Dialogue line ${index + 1} text`} placeholder="Exact words this character says" value={row.text || ""} maxLength={1000} disabled={disabled} onChange={event => patch(row.id, { text: event.target.value })} /></label>
      <label className="node-row"><span className="node-row-label">Pause (s)</span><input aria-label={`Dialogue line ${index + 1} pause`} type="number" min="0" max="3" step="0.1" value={row.pauseAfter ?? 0.3} disabled={disabled} onChange={event => patch(row.id, { pauseAfter: Number(event.target.value) })} /></label>
      <button className="character-add-button" type="button" title={`Remove dialogue line ${index + 1}`} aria-label={`Remove dialogue line ${index + 1}`} disabled={disabled} onClick={() => onChange(rows.filter(item => item.id !== row.id))}><X size={13} /></button>
    </div>)}
    <div className="director-dialogue-actions">
    <button className="character-add-button" type="button" aria-label="Add dialogue line" title="Add dialogue line" disabled={disabled || rows.length >= 24 || (!manual && !characters.length)} onClick={() => onChange([...rows, { id: crypto.randomUUID(), characterNodeId: characters.length === 1 ? characters[0].id : "", text: "", pauseAfter: 0.3 }])}><Plus size={13} /></button>
    {rows.length > 0 && <button className="character-add-button" type="button" aria-label="Regenerate dialogue audio on next run" disabled={disabled} onClick={() => onChange(rows, Date.now())} title="Regenerate dialogue audio on next run (new paid speech requests)"><RefreshCw size={13} /></button>}
    </div>
  </details>;
}
