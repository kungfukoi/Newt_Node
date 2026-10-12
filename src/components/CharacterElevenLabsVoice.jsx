import React from "react";
import { RefreshCw } from "lucide-react";
import { audioModelApi } from "../api/newtApi.js";
import { displayMediaUrl } from "../mediaAssets.js";

let pendingCatalog;
let savedCatalog;
let savedAt = 0;
const loadVoices = async force => {
  if (pendingCatalog) return pendingCatalog;
  if (!force && savedCatalog && Date.now() - savedAt < 60000) return savedCatalog;
  pendingCatalog = audioModelApi.voices(force);
  try { savedCatalog = await pendingCatalog; savedAt = Date.now(); return savedCatalog; }
  finally { pendingCatalog = null; }
};

export function CharacterElevenLabsVoice({ node, onUpdate, onGenerateSample, disabled }) {
  disabled = disabled || node.data.characterVoiceBusy;
  const [voices, setVoices] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const sequence = React.useRef(0);
  const refresh = React.useCallback(async (force = false) => {
    const request = ++sequence.current;
    setLoading(true); setError("");
    try {
      const catalog = await loadVoices(force);
      if (!Array.isArray(catalog.voices)) throw new Error("ElevenLabs returned an invalid voice list.");
      if (sequence.current === request) setVoices(catalog.voices);
    } catch (error) { if (sequence.current === request) { setVoices([]); setError(error.message); } }
    finally { if (sequence.current === request) setLoading(false); }
  }, []);
  React.useEffect(() => {
    void refresh();
    const changed = () => void refresh(true);
    window.addEventListener("newtnode:model-provider-settings-updated", changed);
    return () => { sequence.current++; window.removeEventListener("newtnode:model-provider-settings-updated", changed); };
  }, [refresh]);
  const selected = node.data.characterVoiceProvider === "elevenlabs" ? node.data.characterElevenLabsVoiceId || "" : "";
  const unavailable = selected && !voices.some(voice => voice.id === selected);
  return <div className="character-elevenlabs-voice nodrag nowheel">
    <div className="character-voice-field">
    <label className="character-section-label" htmlFor={`character-voice-${node.id}`}>ElevenLabs</label>
    <div className="character-voice-controls">
    <select id={`character-voice-${node.id}`} aria-label="Character ElevenLabs voice" title="Director or Video Model dialogue uses this voice. Uploaded samples are retained." value={selected} disabled={disabled || loading} onChange={event => {
      const voice = voices.find(item => item.id === event.target.value);
      onUpdate(node.id, { characterVoiceProvider: voice ? "elevenlabs" : "uploaded", characterElevenLabsVoiceId: voice?.id || "", characterElevenLabsVoiceName: voice?.name || "" });
    }}>
      <option value="">Use uploaded dialogue audio</option>
      {unavailable && <option value={selected}>{node.data.characterElevenLabsVoiceName || selected} — unavailable; refresh</option>}
      {["Mine", "Default"].map(group => <optgroup key={group} label={group === "Mine" ? "My voices and custom voices" : "Default voices"}>{voices.filter(voice => voice.group === group).map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</optgroup>)}
    </select>
    <button className="character-add-button" type="button" disabled={disabled || loading} onClick={() => void refresh(true)} aria-label="Refresh Character ElevenLabs voices" title={loading ? "Loading voices…" : "Refresh ElevenLabs voices"}><RefreshCw size={13} /></button>
    </div>
    </div>
    {selected && <details className="character-voice-sample">
      <summary className="character-section-label">Voice sample</summary>
      <label className="character-reference-notes"><textarea aria-label="Character voice sample text" maxLength={300} value={node.data.characterVoiceSampleText ?? "Hello there. I'm glad you're here. Let's explore together, share a story, and discover something wonderful today."} onChange={event => onUpdate(node.id, { characterVoiceSampleText: event.target.value })} disabled={disabled || node.data.characterVoiceBusy} /></label>
      <button type="button" className="character-sample-generate" disabled={disabled || loading || unavailable || node.data.characterVoiceBusy || node.data.characterVoiceSampleText === ""} onClick={onGenerateSample}>{node.data.characterVoiceBusy ? "Generating speech…" : "Generate voice sample"}</button>
      {node.data.characterElevenLabsVoiceSample?.url && <audio aria-label="Character ElevenLabs voice sample" controls preload="none" src={displayMediaUrl(node.data.characterElevenLabsVoiceSample.url)} />}
      {node.data.characterElevenLabsVoiceSample && node.data.characterElevenLabsVoiceSample.voiceId !== selected && <small className="upload-error">Regenerate the sample for the selected voice.</small>}
    </details>}
    {(error || node.data.characterVoiceError) && <small className="upload-error" role="status">{error || node.data.characterVoiceError}</small>}
  </div>;
}
