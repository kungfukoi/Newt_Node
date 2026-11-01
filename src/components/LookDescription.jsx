import React from "react";
import { lookDescriptionBlocks } from "../lookDescription.js";
import { lookStyleText } from "../lookStyleText.js";

function inline(value) {
  return value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part,index)=>part.startsWith("**")?<strong key={index}>{part.slice(2,-2)}</strong>:part.startsWith("`")?<code key={index}>{part.slice(1,-1)}</code>:part);
}
export default function LookDescription({ text, summary = "", title = "Style description" }) {
  if(title==="Style description"){text=lookStyleText(text);summary=lookStyleText(summary);}
  const blocks=lookDescriptionBlocks(text);
  return <section className="library-detail-description" aria-label={title}><h3>{title}</h3>
    {summary&&summary.trim()!==text?.trim()&&<p className="look-description-lead">{summary}</p>}
    <div className="look-description-body">{blocks.map((block,index)=>block.type==="heading"?<h4 key={index}>{inline(block.text)}</h4>:block.type==="list"?React.createElement(block.ordered?"ol":"ul",{key:index},block.items.map((item,number)=><li key={number}>{inline(item)}</li>)):<p key={index}>{block.type==="label"&&<strong className="look-description-label">{block.label}: </strong>}{inline(block.text)}</p>)}</div>
  </section>;
}
