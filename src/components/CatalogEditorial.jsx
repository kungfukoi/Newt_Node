import React from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, Layers, Search, Sparkles, X, RefreshCw } from "lucide-react";
import { styleLibraryApi } from "../api/newtApi.js";

const sectionsFallback = [
  { id: "guides", title: "Guides", description: "Techniques, tools, and creative approaches." },
  { id: "compilations", title: "Compilations", description: "Curated collections of styles and visual ideas." },
  { id: "in-focus", title: "In Focus", description: "Explore the character and possibilities of a style." }
];
const icons = { guides: BookOpen, compilations: Layers, "in-focus": Sparkles };
const mediaUrl = value => styleLibraryApi.catalogAssetUrl(value);

export default function CatalogEditorial({ onOpenLook }) {
  const [catalog, setCatalog] = React.useState(null), [loading, setLoading] = React.useState(false), [error, setError] = React.useState("");
  const [sectionId, setSectionId] = React.useState(""), [query, setQuery] = React.useState("");
  const [article, setArticle] = React.useState(null), [articleLoading, setArticleLoading] = React.useState(false), [articleError, setArticleError] = React.useState("");
  const [previewIndex, setPreviewIndex] = React.useState(null);
  const dialog = React.useRef(null), previewDialog = React.useRef(null), request = React.useRef(0), searchRef = React.useRef(null), lastArticle = React.useRef("");
  const sections = catalog?.sections || sectionsFallback;
  const activeSection = sections.find(item => item.id === sectionId);
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const items = (activeSection?.items || []).filter(item => words.every(word => `${item.title} ${item.summary}`.toLowerCase().includes(word)));
  const images = article ? [...(article.cover ? [article.cover] : []), ...article.blocks.flatMap(block => block.type === "gallery" ? block.images : block.type === "image" ? [block] : [])] : [];
  async function load(refresh = false) {
    setLoading(true); setError("");
    try { setCatalog(await styleLibraryApi.editorial({ refresh })); }
    catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, []);
  function closeArticle() { request.current++; dialog.current?.close(); setArticle(null); setArticleError(""); setArticleLoading(false); }
  function selectSection(id) { closeArticle(); setSectionId(current => current === id ? "" : id); setQuery(""); }
  async function openArticle(id) {
    const version = ++request.current; lastArticle.current = id;
    setArticle(null); setArticleLoading(true); setArticleError("");
    if (!dialog.current?.open) dialog.current?.showModal();
    try { const value = await styleLibraryApi.article(id); if (version === request.current) { setArticle(value); dialog.current?.scrollTo(0, 0); } }
    catch (error) { if (version === request.current) setArticleError(error.message); }
    finally { if (version === request.current) setArticleLoading(false); }
  }
  function navigate(target) {
    if (target?.type === "look") onOpenLook({ id: target.id, catalog: true });
    if (target?.type === "article") openArticle(target.id);
    if (target?.type === "section") { closeArticle(); setSectionId(target.id); setQuery(""); }
  }
  function inline(runs = []) { return runs.map((run, index) => run.link ? <button key={index} className="editorial-inline-link" onClick={() => navigate(run.link)}>{run.text}</button> : <React.Fragment key={index}>{run.text}</React.Fragment>); }
  function enlarge(item) { setPreviewIndex(Math.max(0, images.findIndex(image => image.url === item.url))); if (!previewDialog.current?.open) previewDialog.current?.showModal(); }
  function closePreview() { previewDialog.current?.close(); setPreviewIndex(null); }
  function picture(item, key) { return <figure key={key}><button className="editorial-image-open" onClick={() => enlarge(item)} aria-label={`Enlarge ${item.alt || "article example"}`}><img src={mediaUrl(item.url)} alt={item.alt || "Article example"} loading="lazy" decoding="async" onError={event => { event.currentTarget.style.visibility = "hidden"; event.currentTarget.parentElement.title = "Image not downloaded yet"; }}/></button>{item.caption && <figcaption>{item.caption}</figcaption>}</figure>; }
  return <section className="catalog-editorial" aria-label="Explore the local catalog">
    <div className="editorial-section-heading"><div><span className="stylebuilder-eyebrow">EXPLORE FURTHER</span><h2>Ideas behind the looks</h2></div><button className="stylebuilder-icon" aria-label="Refresh local articles" disabled={loading} onClick={() => load(true)}><RefreshCw size={17}/></button></div>
    <div className="editorial-tiles">{sections.map(section => { const Icon = icons[section.id] || BookOpen; const cover = section.items?.find(item => item.cover)?.cover; return <button key={section.id} className={`editorial-section-tile ${sectionId === section.id ? "active" : ""}`} aria-label={`Browse ${section.title}`} aria-pressed={sectionId === section.id} onClick={() => selectSection(section.id)}><div className="editorial-section-cover">{cover ? <img src={mediaUrl(cover.url)} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = "hidden"; }}/> : <Icon size={34}/>}<span className="editorial-section-icon"><Icon size={19}/></span></div><div className="editorial-section-copy"><div><h3>{section.title}</h3><ArrowUpRight size={19}/></div><p>{section.description}</p><small>{loading ? "Reading local catalog…" : `${section.count || 0} ${section.count === 1 ? "article" : "articles"}`}</small></div></button>; })}</div>
    {error && <p className="library-error" role="alert">{error}<button onClick={() => load(true)}>Retry articles</button></p>}
    {activeSection && <div className="editorial-list" aria-label={`${activeSection.title} articles`}><div className="editorial-list-toolbar"><h3>{activeSection.title}</h3><label className="editorial-search"><Search size={17}/><input ref={searchRef} aria-label={`Search ${activeSection.title}`} placeholder="Search articles" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button aria-label="Clear article search" onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X size={15}/></button>}</label></div>
      <div className="editorial-article-grid">{items.map(item => <button className="editorial-article-card" key={item.id} onClick={() => openArticle(item.id)}>{item.cover && <img src={mediaUrl(item.cover.url)} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.style.visibility = "hidden"; }}/>}<span><strong>{item.title}</strong><small>{item.summary}</small>{item.available === false && <small>Article still downloading</small>}</span></button>)}</div>
      {!items.length && <p className="library-muted">{loading ? "Reading local articles…" : query ? "No articles match this search." : "These articles will appear as the local catalog finishes downloading."}</p>}
    </div>}
    <dialog ref={dialog} className="library-style-detail editorial-reader" aria-label="Catalog article" onCancel={event => { event.preventDefault(); closeArticle(); }}><button className="stylebuilder-detail-close" aria-label="Close article" onClick={closeArticle}><X size={21}/></button><button className="editorial-reader-back" onClick={closeArticle}><ArrowLeft size={16}/> Back to {activeSection?.title || "articles"}</button>
      {articleLoading && <p role="status">Loading local article…</p>}{articleError && <p role="alert" className="library-error">{articleError}<button onClick={() => openArticle(lastArticle.current)}>Retry article</button></p>}
      {article && <article><header><span className="stylebuilder-eyebrow">LOCAL MIDLIBRARY CATALOG</span><h2>{article.title}</h2>{article.author && <p className="library-muted">By {article.author}</p>}{article.lead && <p className="editorial-lead">{article.lead}</p>}</header>{article.cover && picture(article.cover, "cover")}
        {article.blocks.map((block, index) => block.type === "heading" ? <h3 key={index}>{block.link ? <button className="editorial-inline-link" onClick={() => navigate(block.link)}>{block.text} <ArrowUpRight size={16}/></button> : block.text}</h3>
          : block.type === "gallery" ? <div className="editorial-gallery" key={index}>{block.images.map((item, imageIndex) => picture(item, imageIndex))}</div>
          : block.type === "image" ? picture(block, index)
          : block.type === "code" ? <pre key={index}>{block.text}</pre>
          : block.type === "table" ? <div className="editorial-table" key={index}><table><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => cell.heading ? <th key={cellIndex}>{inline(cell.runs)}</th> : <td key={cellIndex}>{inline(cell.runs)}</td>)}</tr>)}</tbody></table></div>
          : <p className={block.type === "list-item" ? "editorial-list-item" : ""} key={index}>{inline(block.runs)}</p>)}
      </article>}
    </dialog>
    <dialog ref={previewDialog} className="library-image-preview" aria-label="Article image preview" onCancel={event => { event.preventDefault(); closePreview(); }} onKeyDown={event => { if (images.length && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); setPreviewIndex(index => (index + (event.key === "ArrowRight" ? 1 : images.length - 1)) % images.length); } }}><button className="library-preview-close" aria-label="Close article image preview" onClick={closePreview}><X size={22}/></button>{previewIndex !== null && images[previewIndex] && <><img src={mediaUrl(images[previewIndex].url)} alt={images[previewIndex].alt || "Article example, enlarged"}/><div className="library-preview-controls"><button aria-label="Previous article image" disabled={images.length < 2} onClick={() => setPreviewIndex(index => (index - 1 + images.length) % images.length)}>Previous</button><span>{previewIndex + 1} / {images.length}</span><button aria-label="Next article image" disabled={images.length < 2} onClick={() => setPreviewIndex(index => (index + 1) % images.length)}>Next</button></div></>}</dialog>
  </section>;
}
