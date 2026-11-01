// Display-only formatting. The source prompt remains unchanged in saved looks and workflows.
export function lookDescriptionBlocks(value = "") {
  const blocks=[];
  for(const raw of String(value).split(/\r?\n/)) {
    const line=raw.trim();if(!line)continue;
    const heading=line.match(/^#{1,6}\s+(.+)$/);
    if(heading){blocks.push({type:"heading",text:heading[1]});continue;}
    const item=line.match(/^(?:([-*+])|\d+[.)])\s+(.+)$/);
    if(item){const ordered=!item[1],previous=blocks.at(-1);if(previous?.type==="list"&&previous.ordered===ordered)previous.items.push(item[2]);else blocks.push({type:"list",ordered,items:[item[2]]});continue;}
    const label=line.match(/^([A-Za-z][A-Za-z /&-]{1,45}):\s+(.+)$/);
    if(label){blocks.push({type:"label",label:label[1],text:label[2]});continue;}
    if(line.length>600){
      const sentences=line.split(/(?<=[.!?])\s+(?=[A-Z])/);let paragraph="";
      for(const sentence of sentences){if(paragraph.length>250){blocks.push({type:"paragraph",text:paragraph});paragraph="";}paragraph+=`${paragraph?" ":""}${sentence}`;}
      if(paragraph)blocks.push({type:"paragraph",text:paragraph});
    }else blocks.push({type:"paragraph",text:line});
  }
  return blocks;
}
