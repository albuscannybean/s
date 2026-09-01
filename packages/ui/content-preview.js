const decodeEntities=value=>String(value??'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'");

export function firstDisplayFormula(source){
  const text=String(source??'');
  const block=text.match(/\$\$([\s\S]*?)\$\$/)||text.match(/\\\[([\s\S]*?)\\\]/);
  return block?.[1]?.trim()??'';
}

export function markdownToPlainText(source){
  return decodeEntities(String(source??''))
    .replace(/```[\s\S]*?```/g,' ')
    .replace(/\$\$[\s\S]*?\$\$/g,' 数学公式 ')
    .replace(/\\\[[\s\S]*?\\\]/g,' 数学公式 ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
    .replace(/`([^`]+)`/g,'$1')
    .replace(/\$([^$\n]+)\$/g,'$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm,'')
    .replace(/^\s*>\s?/gm,'')
    .replace(/^\s*(?:[-*+] |\d+\. )/gm,'')
    .replace(/[*_~]/g,'')
    .replace(/<[^>]+>/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

export function contentPreview(content={},options={}){
  const maxChars=Math.max(80,Number(options.maxChars??260));
  const summary=markdownToPlainText(content.summary),body=markdownToPlainText(content.body),text=summary||body;
  return{
    title:String(content.title??'').trim(),
    excerpt:text.length>maxChars?`${text.slice(0,maxChars).trimEnd()}…`:text,
    displayFormula:firstDisplayFormula(content.body),
    empty:!String(content.title??'').trim()&&!String(content.summary??'').trim()&&!String(content.body??'').trim()
  };
}

export function isSubstantiveContent(content={}){
  return Boolean(String(content.title??'').trim()||String(content.summary??'').trim()||String(content.body??'').trim()||(content.tags??[]).some(value=>String(value).trim()));
}
