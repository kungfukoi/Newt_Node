import React from "react";
import { lookDescriptionBlocks } from "../lookDescription.js";

function inline(value) {
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part,index)=>part.startsWith("**")?<strong key={index}>{part.slice(2,-2)}</strong>:part.startsWith("`")?<code key={index}>{part.slice(1,-1)}</code>:part);
}
export default function LookDescription({ text, summary = "" }) {
  const blocks=lookDescriptionBlocks(text);
  return <section className="library-detail-description" aria-label="Style description"><h3>Style description</h3>
    {summary&&summary.trim()!==text?.trim()&&<p className="look-description-lead">{summary}</p>}
    <div className="look-description-body">{blocks.map((block,index)=>block.type==="heading"?<h4 key={index}>{inline(block.text)}</h4>:block.type==="list"?React.createElement(block.ordered?"ol":"ul",{key:index},block.items.map((item,number)=><li key={number}>{inline(item)}</li>)):<p key={index}>{block.type==="label"&&<strong className="look-description-label">{block.label}: </strong>}{inline(block.text)}</p>)}</div>
  </section>;
}
