import Navbar from './components/Navbar'
import LocationMap from './components/LocationMap'
import ScrollArrow from './components/ScrollArrow'
import { directionsUrl } from './config/location'
import initialLocation from './config/location.json'
import './App.css'

const categories = [
  { name: 'Juguetería', label: 'Un mundo para jugar', description: 'Ideas que despiertan la imaginación.', color: 'pink', art: 'bear' },
  { name: 'Bazar', label: 'Detalles para todos los días', description: 'Prácticos, lindos y para cada rincón.', color: 'yellow', art: 'vase' },
  { name: 'Artículos escolares', label: 'Todo para crear y aprender', description: 'Color e inspiración en cada trazo.', color: 'blue', art: 'pencils' },
  { name: 'Cotillón', label: 'Que empiece la fiesta', description: 'Pequeños detalles, grandes festejos.', color: 'green', art: 'party' },
]
const whatsapp = (category = '') => `https://wa.me/59894471227?text=${encodeURIComponent(`¡Hola Oscal! Me gustaría recibir el catálogo${category ? ` de ${category}` : ''}.`)}`

function Arrow() { return <svg className="arrow-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> }
function Pin() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7"/></svg> }
function Chat() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 11.5a9 9 0 0 1-13.2 8L3 21l1.5-4.8A9 9 0 1 1 21 11.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M8 8c0 4 4 8 8 8l1-2-3-1-1 1-3-3 1-1-1-3-2 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg> }
function Art({ kind }: { kind: string }) {
  return <svg viewBox="0 0 240 210" fill="none" aria-hidden="true" className="product-art">
    {kind === 'bear' && <g stroke="#59352e" strokeWidth="3"><circle cx="73" cy="49" r="24" fill="#b57a50"/><circle cx="167" cy="49" r="24" fill="#b57a50"/><ellipse cx="120" cy="142" rx="55" ry="56" fill="#c98d60"/><ellipse cx="64" cy="140" rx="22" ry="35" fill="#c98d60" transform="rotate(25 64 140)"/><ellipse cx="176" cy="140" rx="22" ry="35" fill="#c98d60" transform="rotate(-25 176 140)"/><ellipse cx="88" cy="185" rx="28" ry="19" fill="#b57a50"/><ellipse cx="152" cy="185" rx="28" ry="19" fill="#b57a50"/><circle cx="120" cy="76" r="52" fill="#ce9669"/><ellipse cx="120" cy="95" rx="25" ry="20" fill="#f1d5b0"/><circle cx="100" cy="72" r="4" fill="#59352e"/><circle cx="140" cy="72" r="4" fill="#59352e"/><path d="M113 88 Q120 82 127 88 L120 96Z" fill="#59352e"/><path d="M120 97v7m-9 0q9 9 18 0"/><path d="M94 125l26 11-26 11zM146 125l-26 11 26 11z" fill="#ed4b43" stroke="#b53330"/><circle cx="120" cy="136" r="6" fill="#ed4b43"/></g>}
    {kind === 'vase' && <g strokeWidth="3"><path d="M105 91Q68 120 87 182Q120 201 154 182Q173 120 136 91L139 65H102Z" fill="#f6efe2" stroke="#c3ae8d"/><path d="M107 94h28M90 145q30 13 60 0M91 159q29 13 58 0" stroke="#dfceb4"/><path d="M121 70Q107 15 71 22M122 71q8-57 40-60M122 76q28-40 65-31" stroke="#697f4c"/><path d="M98 42Q58 48 61 14Q91 9 98 42M139 39q-8-32 27-36q14 27-27 36M155 59q11-35 45-20q-5 33-45 20" fill="#7c9660" stroke="#697f4c"/><path d="M51 147h30v43H43v-35q0-8 8-8Z" fill="#dc7b50" stroke="#a95737"/><path d="M80 157q30-5 23 18q-5 10-23 3" stroke="#a95737"/></g>}
    {kind === 'pencils' && <g stroke="#354574" strokeWidth="2.5"><path d="M52 181l115-20-18-123L34 58Z" fill="#f7f3e6"/><path d="M48 72l90-16M51 84l90-16M54 96l90-16M57 108l90-16M60 120l90-16M63 132l90-16M66 144l90-16" stroke="#c2cbd7"/><path d="M42 59l19 121" stroke="#ec6b66"/><g transform="rotate(15 160 105)"><path d="M149 34h18v131l-9 24-9-24Z" fill="#ffc951"/><path d="M149 165h18l-9 24Z" fill="#f0cfaa"/><path d="M154 181h8l-4 8Z" fill="#354574"/><path d="M149 33v-9q9-10 18 0v9Z" fill="#ef716d"/><path d="M158 37v124" stroke="#e29b28"/></g><g transform="rotate(28 189 110)"><path d="M180 47h16v119l-8 23-8-23Z" fill="#729bad"/><path d="M180 166h16l-8 23Z" fill="#f0cfaa"/><path d="M185 181h6l-3 8Z" fill="#354574"/></g></g>}
    {kind === 'party' && <g strokeWidth="3"><path d="M79 183L116 71l69 97Z" fill="#f1b856" stroke="#bc8540"/><path d="M95 136l52 13M104 109l25 7M87 164l78 6" stroke="#ef6559" strokeWidth="10"/><path d="M88 187l100-18" stroke="#f4e0ae" strokeWidth="12"/><path d="M103 44q-30-20-39 1M138 39q24-29 13-37M170 79q38-6 31-29" stroke="#e66d68"/><path d="M53 99l7 9M182 117l12-5M177 23l9 5M80 72l-8-4" stroke="#6b94bd" strokeWidth="7"/><path d="M120 53l-5-13M201 92l8 7" stroke="#e5b13e" strokeWidth="7"/><circle cx="50" cy="149" r="5" fill="#e66d68"/><circle cx="197" cy="145" r="5" fill="#6b94bd"/></g>}
  </svg>
}

function App() {
  const location = initialLocation
  return <>
    <a className="skip-link" href="#contenido">Ir al contenido</a>
    <Navbar catalogUrl={whatsapp()} />
    <main id="contenido">
      <section className="hero" id="inicio" aria-labelledby="hero-title">
        <img className="hero-background" src="/oscal-hero-background.jpg" alt="" width="4160" height="3120" fetchPriority="high" aria-hidden="true"/>
        <div className="hero-copy wrapper">
          <p className="eyebrow"><span className="red-dot"/> EN EL BARRIO DE LOS JUDÍOS</p>
          <h1 id="hero-title">Lo que buscás<br/><em>está en</em> <span className="hero-logo"><img src="/oscal-logo.svg" alt="Oscal" width="581" height="261"/></span></h1>
          <p className="hero-description">Juguetería · Bazar · Escolares · Cotillón</p>
        </div>
        <ScrollArrow />
      </section>
      <section className="categories wrapper" id="rubros" aria-labelledby="rubros-title"><div className="section-heading"><div><p className="eyebrow">ENCONTRÁ TU PRÓXIMA IDEA</p><h2 id="rubros-title">Cuatro rubros.<br/>Infinitas posibilidades<span>.</span></h2></div><p>Para los momentos de siempre<br/>y para los que están por venir.</p></div><div className="category-grid">{categories.map((category, index) => <a className={`category-card ${category.color}`} href={whatsapp(category.name)} target="_blank" rel="noreferrer" key={category.name} aria-label={`Consultar catálogo de ${category.name} por WhatsApp`}><div className="category-top"><span className="category-number">0{index + 1}</span><span className="circle-arrow"><Arrow /></span></div><div className="category-image"><Art kind={category.art}/></div><div className="category-detail"><h3>{category.name}</h3><p>{category.description}</p><span className="category-link">Descubrí el rubro <Arrow /></span></div></a>)}</div></section>
      <section className="about wrapper" id="nosotros" aria-labelledby="about-title"><div className="about-heading"><p className="eyebrow">HOLA, SOMOS OSCAL</p><h2 id="about-title">Un solo lugar.<br/>Mucho por<br/><em>descubrir.</em></h2><span className="about-spark" aria-hidden="true">✳</span></div><div className="about-copy"><p>Nos gustan los objetos que hacen el día más divertido, la casa más linda y cada festejo más especial.</p><p>Por eso reunimos juguetes, artículos de bazar, útiles escolares y cotillón: variedad que inspira nuevas posibilidades para tu negocio.</p><a className="text-link" href="#contacto">Vení a conocernos <Arrow /></a><div className="about-signature"><img src="/oscal-logo.svg" alt="Oscal SRL Importaciones" width="581" height="261"/><span>De Montevideo,<br/>para tus próximas ideas.</span></div></div></section>
      <section className="catalog-section" id="catalogo" aria-labelledby="catalog-title"><div className="wrapper catalog-inner"><div className="catalog-copy"><p className="eyebrow">HABLEMOS DE TU PRÓXIMO PEDIDO</p><h2 id="catalog-title">Tu próxima idea<br/>empieza con un <em>hola.</em></h2><p>Pedí el catálogo por WhatsApp y consultanos por los productos que estás buscando.</p><a className="button button-red" href={whatsapp()} target="_blank" rel="noreferrer"><Chat /> Pedí tu catálogo <Arrow /></a></div><ol className="catalog-steps"><li><span>01</span><div><h3>Escribinos</h3><p>Contanos qué rubro te interesa.</p></div></li><li><span>02</span><div><h3>Descubrí el catálogo</h3><p>Conocé las opciones para tu negocio.</p></div></li><li><span>03</span><div><h3>Armá tu próxima idea</h3><p>Consultá disponibilidad y detalles de tu pedido.</p></div></li></ol></div></section>
      <section className="contact wrapper" id="contacto" aria-labelledby="contact-title">
        <div className="contact-copy"><p className="eyebrow">TE ESPERAMOS EN MONTEVIDEO</p><h2 id="contact-title">Pasá. Mirá.<br/><em>Inspirate.</em></h2><p>Estamos en Arenal Grande 2178.<br/>Vení a descubrir todo lo que tenemos para vos.</p><a className="button button-outline" href={directionsUrl(location)} target="_blank" rel="noreferrer"><Pin /> Cómo llegar <Arrow /></a></div>
        <div className="contact-panel"><div className="address-row"><span className="contact-icon"><Pin /></span><div><span className="eyebrow">ENCONTRANOS ACÁ</span><h3>Arenal Grande 2178</h3><p>Montevideo, Uruguay</p></div></div><div className="contact-divider"/><p className="eyebrow">CONVERSEMOS POR WHATSAPP</p><a className="phone-link" href={whatsapp()} target="_blank" rel="noreferrer"><span>094 471 227</span><Arrow /></a><a className="phone-link" href="https://wa.me/59893657542" target="_blank" rel="noreferrer"><span>093 657 542</span><Arrow /></a><p className="contact-note">¿Tenés algo en mente? Nos encantará ayudarte.</p></div>
        <LocationMap position={location} />
      </section>
    </main>
    <footer className="site-footer"><div className="wrapper footer-main"><a className="footer-brand" href="#inicio" aria-label="Volver al inicio"><img src="/oscal-logo.svg" alt="Oscal Importaciones" width="581" height="261"/></a><p>Pequeños objetos.<br/><strong>Grandes posibilidades.</strong></p><a className="text-link" href="#inicio">Volver arriba <span aria-hidden="true">↑</span></a></div><div className="wrapper footer-bottom"><span>© {new Date().getFullYear()} Oscal SRL Importaciones</span><span>Juguetería · Bazar · Escolares · Cotillón</span></div></footer>
    <a className="floating-whatsapp" href={whatsapp()} target="_blank" rel="noreferrer" aria-label="Contactar a Oscal por WhatsApp"><Chat /></a>
  </>
}
export default App
