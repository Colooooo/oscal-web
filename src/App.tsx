import Navbar from './components/Navbar'
import Art from './components/ProductArt'
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
function App() {
  const location = initialLocation
  return <>
    <a className="skip-link" href="#contenido">Ir al contenido</a>
    <Navbar />
    <main id="contenido">
      <section className="hero" id="inicio" aria-labelledby="hero-title">
        <img className="hero-background" src="/oscal-hero-1280.webp" srcSet="/oscal-hero-640.webp 640w, /oscal-hero-1280.webp 1280w, /oscal-hero-1920.webp 1920w" sizes="100vw" alt="" width="4160" height="3120" fetchPriority="high" aria-hidden="true"/>
        <div className="hero-copy wrapper">
          <p className="eyebrow"><span className="red-dot"/> EN EL BARRIO DE LOS JUDÍOS</p>
          <h1 id="hero-title">Lo que buscás<br/><em>está en</em> <span className="hero-logo"><img src="/oscal-logo.svg" alt="Oscal" width="581" height="261"/></span></h1>
          <p className="hero-description">Juguetería · Bazar · Escolares · Cotillón</p>
        </div>
        <ScrollArrow />
      </section>
      <section className="categories wrapper" id="rubros" aria-labelledby="rubros-title"><div className="section-heading"><div><p className="eyebrow">ENCONTRÁ TU PRÓXIMA IDEA</p><h2 id="rubros-title">Cuatro rubros.<br/>Infinitas posibilidades<span>.</span></h2></div><p>Para los momentos de siempre<br/> y para los que están por venir</p></div><div className="category-grid">{categories.map((category, index) => <a className={`category-card ${category.color}`} href={`/catalogo?categoria=${encodeURIComponent(category.name)}`} key={category.name} aria-label={`Consultar catálogo de ${category.name} `}><div className="category-top"><span className="category-number">0{index + 1}</span><span className="circle-arrow"><Arrow /></span></div><div className="category-image"><Art kind={category.art}/></div><div className="category-detail"><h3>{category.name}</h3><p>{category.description}</p><span className="category-link">Descubrí el rubro <Arrow /></span></div></a>)}</div></section>
      <section className="about wrapper" id="nosotros" aria-labelledby="about-title"><div className="about-heading"><p className="eyebrow">SOMOS OSCAL</p><h2 id="about-title">Un solo lugar.<br/>Mucho por<br/><em>descubrir.</em></h2></div><div className="about-copy"><p>Nos gustan los objetos que hacen el día más divertido, la casa más linda y cada festejo más especial.</p><p>Por eso reunimos juguetes, artículos de bazar, útiles escolares y cotillón: variedad que inspira nuevas posibilidades para tu negocio.</p><a className="text-link" href="#contacto">Vení a conocernos <Arrow /></a><div className="about-signature"><img src="/oscal-logo.svg" alt="Oscal SRL Importaciones" width="581" height="261"/><span>De Montevideo,<br/>para tus próximas ideas.</span></div></div></section>
      <section className="catalog-section" id="catalogo" aria-labelledby="catalog-title"><div className="wrapper catalog-inner"><div className="catalog-copy"><p className="eyebrow">HABLEMOS DE TU PRÓXIMO PEDIDO</p><h2 id="catalog-title">Tu próxima idea<br/>empieza con un <em>hola.</em></h2><p>Explorá los rubros, agregá tus favoritos al carrito y revisá tu pedido en un solo lugar.</p><a className="button button-red" href="/catalogo"><Chat /> Explorá el catálogo <Arrow /></a></div><ol className="catalog-steps"><li><span>01</span><div><h3>Elegí tus favoritos</h3><p>Buscá por producto o explorá cada rubro.</p></div></li><li><span>02</span><div><h3>Armá tu carrito</h3><p>Elegí cantidades y revisá el resumen.</p></div></li><li><span>03</span><div><h3>Elegí cómo recibirlo</h3><p>Retirá en el local o consultá por envío.</p></div></li></ol></div></section>
      <section className="contact wrapper" id="contacto" aria-labelledby="contact-title">
        <div className="contact-copy"><p className="eyebrow">TE ESPERAMOS EN MONTEVIDEO</p><h2 id="contact-title">Pasá. Mirá.<br/><em>Inspirate.</em></h2><p>Estamos en Arenal Grande 2178<br/>Vení a descubrir todo lo que tenemos para vos.</p><a className="button button-outline" href={directionsUrl(location)} target="_blank" rel="noreferrer"><Pin /> Cómo llegar <Arrow /></a></div>
        <div className="contact-panel"><div className="address-row"><span className="contact-icon"><Pin /></span><div><span className="eyebrow">ENCONTRANOS ACÁ</span><h3>Arenal Grande 2178</h3><p>Montevideo, Uruguay</p></div></div><div className="contact-divider"/><p className="eyebrow">CONVERSEMOS POR WHATSAPP</p><a className="phone-link" href={whatsapp()} target="_blank" rel="noreferrer"><span>094 471 227</span><Arrow /></a><a className="phone-link" href="https://wa.me/59893657542" target="_blank" rel="noreferrer"><span>093 657 542</span><Arrow /></a></div>
        <LocationMap position={location} />
      </section>
    </main>
    <footer className="site-footer"><div className="wrapper footer-main"><a className="footer-brand" href="#inicio" aria-label="Volver al inicio"><img src="/oscal-logo.svg" alt="Oscal Importaciones" width="581" height="261"/></a><p>Pequeños objetos.<br/><strong>Grandes posibilidades.</strong></p><a className="text-link" href="#inicio">Volver arriba <span aria-hidden="true">↑</span></a></div><div className="wrapper footer-bottom"><span>© {new Date().getFullYear()} Oscal SRL Importaciones</span><span>Juguetería · Bazar · Escolares · Cotillón</span></div></footer>
    <a className="floating-whatsapp" href={whatsapp()} target="_blank" rel="noreferrer" aria-label="Contactar a Oscal por WhatsApp"><Chat /></a>
  </>
}
export default App
