import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import { useTheme } from "next-themes";
import { useLanguage } from "@/context/LanguageContext";
import ModeToggle from "@/components/ModeToggle";

// ─── Landing-page translations ────────────────────────────────────────────────

const T = {
  en: {
    navFeatures: "Features",
    navHow: "How it works",
    navPricing: "Pricing",
    navSignIn: "Sign in",
    navCta: "Get started free",
    heroBadge: "Paraguay invoice formatting · AI-powered",
    heroLine1: "Generate professional",
    heroLine2: "Paraguay invoice templates",
    heroLine3: "from a single sentence",
    heroDesc:
      "Describe the invoice you need in natural language. Facturia generates the template — complete with IVA breakdown, RUC, timbrado, and your company logo — ready to print or issue, in seconds.",
    startFree: "Start for free",
    watchDemo: "Watch the demo",
    trust1: "No invoice knowledge needed",
    trust2: "Instant HTML download",
    trust3: "Free to start",
    demoCaption:
      "Click the play button to see a live walkthrough · best with sound on",
    featTitle: "Everything you need to invoice in Paraguay",
    featDesc:
      "Built for small businesses and freelancers who need professional invoices without the accounting software overhead.",
    f1t: "AI-powered generation",
    f1d: "Just describe the invoice you need — layout, style, items. The AI handles the formatting, Paraguay's required invoice fields, and your company details automatically.",
    f2t: "Paraguay format built in",
    f2d: "Every template includes the required IVA breakdown (Exentas, Gravado 5%, Gravado 10%), Condición de Venta field, and timbrado — no manual setup needed.",
    f3t: "Company presets",
    f3d: "Save your RUC, timbrado, logo, address, and contact details once. They're automatically injected into every invoice — including your logo.",
    f4t: "Template library",
    f4d: "Save your best invoice designs and reuse them with one click. Edit in natural language, rename inline, or download as ready-to-use HTML.",
    f5t: "Three languages",
    f5d: "Full EN / ES / PT interface. Switch languages instantly from Settings — every UI string is translated for your team.",
    f6t: "Two AI models",
    f6d: "Choose between DeepSeek V3 for fast generation and DeepSeek R1 Reasoner for complex templates. Switch per-conversation from the input bar.",
    howTitle: "Up and running in under two minutes",
    howDesc:
      "No accounting software knowledge required. If you can describe what you need, Facturia can generate it.",
    s1n: "01",
    s1t: "Set up your company preset",
    s1d: "Enter your business name, RUC, timbrado number, logo, address, and contact details once. Facturia stores them securely and injects them into every invoice automatically.",
    s2n: "02",
    s2t: "Describe your invoice",
    s2d: 'Type a natural-language prompt like "Make a clean invoice for a consulting project, two items at 10% IVA". No forms, no field mapping.',
    s3n: "03",
    s3t: "Preview, save, download",
    s3d: "See a live preview instantly. Save it to your template library, download as HTML, or open in a new tab to print or share.",
    ctaTitle: "Ready to generate your first invoice?",
    ctaDesc:
      "Start with a free trial — no credit card required. Describe your invoice and see Facturia generate it live.",
    ctaBtn: "Get started for free",
    ctaNote: "Free trial · No setup · Instant templates",
    footerLine: "AI invoice template generation for Paraguay.",
    footerSignIn: "Sign in",
    footerRegister: "Register",
  },
  es: {
    navFeatures: "Características",
    navHow: "Cómo funciona",
    navPricing: "Precios",
    navSignIn: "Iniciar sesión",
    navCta: "Comenzar gratis",
    heroBadge: "Formato de factura paraguayo · Impulsado por IA",
    heroLine1: "Generá plantillas de factura",
    heroLine2: "profesionales de Paraguay",
    heroLine3: "con una sola frase",
    heroDesc:
      "Describí la factura que necesitás en lenguaje natural. Facturia genera la plantilla — con desglose de IVA, RUC, timbrado y el logo de tu empresa — lista para imprimir o usar, en segundos.",
    startFree: "Empezar gratis",
    watchDemo: "Ver demostración",
    trust1: "Sin conocimientos contables",
    trust2: "Descarga HTML instantánea",
    trust3: "Gratis para empezar",
    demoCaption:
      "Hacé clic en el botón de reproducción para ver la demo en vivo · mejor con sonido activado",
    featTitle: "Todo lo que necesitás para facturar en Paraguay",
    featDesc:
      "Diseñado para pequeñas empresas y freelancers que necesitan facturas profesionales sin la complejidad de un software contable.",
    f1t: "Generación con IA",
    f1d: "Describí la factura que necesitás — diseño, estilo, ítems. La IA se encarga del formato, los campos que exige Paraguay y los datos de tu empresa automáticamente.",
    f2t: "Formato Paraguay incluido",
    f2d: "Cada plantilla incluye el desglose de IVA requerido (Exentas, Gravado 5%, Gravado 10%), campo de Condición de Venta y timbrado — sin configuración manual.",
    f3t: "Presets de empresa",
    f3d: "Guardá tu RUC, timbrado, logo, dirección y datos de contacto una sola vez. Se inyectan automáticamente en cada factura que generás.",
    f4t: "Biblioteca de plantillas",
    f4d: "Guardá tus mejores diseños de factura y reutilizalos con un clic. Editarlos en lenguaje natural, renombralos en línea o descargalos como archivos HTML.",
    f5t: "Tres idiomas",
    f5d: "Interfaz completa en EN / ES / PT. Cambiá de idioma al instante desde Configuración — todos los textos están traducidos.",
    f6t: "Dos modelos de IA",
    f6d: "Elegí entre DeepSeek V3 para generación rápida y DeepSeek R1 Reasoner para plantillas complejas. Cambiá por conversación desde la barra de entrada.",
    howTitle: "Listo para usar en menos de dos minutos",
    howDesc:
      "No se requieren conocimientos de software contable. Si podés describir lo que necesitás, Facturia puede generarlo.",
    s1n: "01",
    s1t: "Configurá tu preset de empresa",
    s1d: "Ingresá el nombre de tu empresa, RUC, timbrado, logo, dirección y datos de contacto una sola vez. Facturia los guarda de forma segura e los inyecta automáticamente.",
    s2n: "02",
    s2t: "Describí tu factura",
    s2d: 'Escribí un prompt como "Hacé una factura simple para un proyecto de consultoría de software, dos ítems al 10% de IVA". Sin formularios, sin mapeo de campos.',
    s3n: "03",
    s3t: "Previsualizar, guardar, descargar",
    s3d: "Ves una vista previa de tu factura al instante. Guardala en tu biblioteca de plantillas, descargala como HTML o abrila en una nueva pestaña para imprimir.",
    ctaTitle: "¿Listo para generar tu primera factura?",
    ctaDesc:
      "Comenzá con una prueba gratuita — sin tarjeta de crédito. Describí tu factura y mirá cómo Facturia la genera en vivo.",
    ctaBtn: "Comenzar gratis",
    ctaNote: "Prueba gratuita · Sin configuración · Plantillas instantáneas",
    footerLine: "Generación de plantillas de factura con IA para Paraguay.",
    footerSignIn: "Iniciar sesión",
    footerRegister: "Registrarse",
  },
  pt: {
    navFeatures: "Funcionalidades",
    navHow: "Como funciona",
    navPricing: "Preços",
    navSignIn: "Entrar",
    navCta: "Começar grátis",
    heroBadge: "Formato de fatura paraguaio · Powered by IA",
    heroLine1: "Gere modelos de fatura profissionais",
    heroLine2: "do Paraguai",
    heroLine3: "com uma única frase",
    heroDesc:
      "Descreva a fatura que precisa em linguagem natural. Facturia gera o modelo — com discriminação de IVA, RUC, timbrado e o logo da sua empresa — pronto para imprimir ou usar, em segundos.",
    startFree: "Começar grátis",
    watchDemo: "Ver demonstração",
    trust1: "Sem conhecimentos contábeis",
    trust2: "Download HTML instantâneo",
    trust3: "Grátis para começar",
    demoCaption:
      "Clique no botão de reprodução para ver uma demonstração ao vivo · melhor com o som ligado",
    featTitle: "Tudo que você precisa para faturar no Paraguai",
    featDesc:
      "Criado para pequenas empresas e freelancers que precisam de faturas profissionais sem a complexidade de um software contábil.",
    f1t: "Geração com IA",
    f1d: "Basta descrever a fatura que você precisa — layout, estilo, itens. A IA cuida da formatação, dos campos exigidos no Paraguai e dos dados da sua empresa automaticamente.",
    f2t: "Formato do Paraguai incluído",
    f2d: "Cada modelo inclui a discriminação de IVA exigida (Exentas, Gravado 5%, Gravado 10%), campo Condición de Venta e timbrado — sem configuração manual.",
    f3t: "Predefinições de empresa",
    f3d: "Salve seu RUC, timbrado, logo, endereço e dados de contato uma vez. Eles são injetados automaticamente em cada fatura gerada.",
    f4t: "Biblioteca de modelos",
    f4d: "Salve seus melhores designs de fatura e reutilize com um clique. Edite em linguagem natural, renomeie ou baixe como arquivos HTML prontos.",
    f5t: "Três idiomas",
    f5d: "Interface completa em EN / ES / PT. Mude de idioma instantaneamente em Configurações — todos os textos estão traduzidos.",
    f6t: "Dois modelos de IA",
    f6d: "Escolha entre DeepSeek V3 para geração rápida e DeepSeek R1 Reasoner para modelos complexos. Mude por conversa na barra de entrada.",
    howTitle: "Pronto para usar em menos de dois minutos",
    howDesc:
      "Não são necessários conhecimentos de software contábil. Se você consegue descrever o que precisa, Facturia pode gerá-lo.",
    s1n: "01",
    s1t: "Configure sua predefinição de empresa",
    s1d: "Insira o nome da sua empresa, RUC, número de timbrado, logo, endereço e dados de contato uma vez. Facturia os armazena com segurança e os injeta automaticamente.",
    s2n: "02",
    s2t: "Descreva sua fatura",
    s2d: 'Digite um prompt como "Faça uma fatura simples para um projeto de consultoria de software, dois itens com 10% de IVA". Sem formulários, sem mapeamento.',
    s3n: "03",
    s3t: "Visualizar, salvar, baixar",
    s3d: "Veja uma visualização ao vivo da sua fatura instantaneamente. Salve na biblioteca de modelos, baixe como HTML ou abra em uma nova aba para imprimir.",
    ctaTitle: "Pronto para gerar sua primeira fatura?",
    ctaDesc:
      "Comece com um teste gratuito — sem cartão de crédito. Descreva sua fatura e veja o Facturia gerá-la ao vivo.",
    ctaBtn: "Começar grátis",
    ctaNote: "Teste grátis · Sem configuração · Modelos instantâneos",
    footerLine: "Geração de modelos de fatura com IA para o Paraguai.",
    footerSignIn: "Entrar",
    footerRegister: "Registrar",
  },
} as const;

type Lang = keyof typeof T;

// ─── Hero demo (iframe) ───────────────────────────────────────────────────────

const DEMO_W = 1200;
const DEMO_H = 700;

function HeroDemo() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / DEMO_W);
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const send = () => {
      iframe.contentWindow?.postMessage(
        { type: "theme", value: resolvedTheme === "light" ? "light" : "dark" },
        "*"
      );
    };
    iframe.addEventListener("load", send);
    send();
    return () => iframe.removeEventListener("load", send);
  }, [resolvedTheme]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "wheel") {
        window.scrollBy({ top: e.data.deltaY, left: e.data.deltaX, behavior: "instant" });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: DEMO_H * scale, overflow: "hidden" }}>
      <iframe
        ref={iframeRef}
        src="/facturia-hero.html"
        style={{
          width: DEMO_W,
          height: DEMO_H,
          border: "none",
          display: "block",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}

// ─── Landing page sections ────────────────────────────────────────────────────

function LandingNav() {
  const { lang, setLang } = useLanguage();
  const t = (k: keyof typeof T.en) => (T[lang as Lang] ?? T.en)[k];
  const langs: { code: Lang; label: string }[] = [
    { code: "en", label: "EN" },
    { code: "es", label: "ES" },
    { code: "pt", label: "PT" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="font-bold text-xl tracking-tight">
            Factur<span className="text-primary">ia</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t("navFeatures")}</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">{t("navHow")}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{t("navPricing")}</a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <div className="hidden sm:flex items-center gap-1 mr-2">
            {langs.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`h-7 px-2 rounded text-xs font-medium transition-colors ${lang === code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <ModeToggle />
          <Link to="/login" className="hidden sm:block text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
            {t("navSignIn")}
          </Link>
          <Link to="/login" className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            {t("navCta")}
          </Link>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  const { lang } = useLanguage();
  const t = (k: keyof typeof T.en) => (T[lang as Lang] ?? T.en)[k];

  return (
    <section className="pt-24 pb-16 text-center px-6 bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-3xl">
        <div className="inline-flex items-center gap-2 text-xs font-medium bg-primary/10 text-primary px-3 py-1.5 rounded-full mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          {t("heroBadge")}
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.08] mb-6">
          {t("heroLine1")}<br />
          <span className="text-primary">{t("heroLine2")}</span><br />
          {t("heroLine3")}
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
          {t("heroDesc")}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/login" className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-primary text-primary-foreground text-base font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
            {t("startFree")}
          </Link>
          <a href="#demo" className="inline-flex items-center justify-center h-12 px-8 rounded-xl border border-border text-base font-medium hover:bg-accent transition-colors">
            {t("watchDemo")}
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-12 text-sm text-muted-foreground">
          {[t("trust1"), t("trust2"), t("trust3")].map((label) => (
            <span key={label} className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-primary shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const { lang } = useLanguage();
  const t = (k: keyof typeof T.en) => (T[lang as Lang] ?? T.en)[k];

  const features = [
    {
      key: "f1",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>,
      title: t("f1t"), desc: t("f1d"),
    },
    {
      key: "f2",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>,
      title: t("f2t"), desc: t("f2d"),
    },
    {
      key: "f3",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg>,
      title: t("f3t"), desc: t("f3d"),
    },
    {
      key: "f4",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>,
      title: t("f4t"), desc: t("f4d"),
    },
    {
      key: "f5",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" /></svg>,
      title: t("f5t"), desc: t("f5d"),
    },
    {
      key: "f6",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
      title: t("f6t"), desc: t("f6d"),
    },
  ];

  return (
    <section id="features" className="py-24 px-6 bg-background">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{t("featTitle")}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("featDesc")}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.key} className="rounded-2xl border border-border bg-card p-7 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                {f.icon}
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const { lang } = useLanguage();
  const t = (k: keyof typeof T.en) => (T[lang as Lang] ?? T.en)[k];

  const steps = [
    { num: t("s1n"), title: t("s1t"), desc: t("s1d") },
    { num: t("s2n"), title: t("s2t"), desc: t("s2d") },
    { num: t("s3n"), title: t("s3t"), desc: t("s3d") },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6 bg-muted/40">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{t("howTitle")}</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">{t("howDesc")}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-6">
                <span className="text-primary font-bold text-lg">{s.num}</span>
              </div>
              <h3 className="font-semibold text-lg mb-3">{s.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const { lang } = useLanguage();
  const t = (k: keyof typeof T.en) => (T[lang as Lang] ?? T.en)[k];

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{t("ctaTitle")}</h2>
        <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">{t("ctaDesc")}</p>
        <Link to="/login" className="inline-flex items-center justify-center h-14 px-10 rounded-xl bg-primary text-primary-foreground text-lg font-semibold hover:bg-primary/90 transition-colors shadow-xl shadow-primary/20">
          {t("ctaBtn")}
        </Link>
        <p className="text-sm text-muted-foreground mt-6">{t("ctaNote")}</p>
      </div>
    </section>
  );
}

function LandingFooter() {
  const { lang } = useLanguage();
  const t = (k: keyof typeof T.en) => (T[lang as Lang] ?? T.en)[k];

  return (
    <footer className="border-t border-border py-12 px-6">
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="font-bold text-lg tracking-tight">
          Factur<span className="text-primary">ia</span>
        </div>
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Facturia. {t("footerLine")}</p>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link to="/login" className="hover:text-foreground transition-colors">{t("footerSignIn")}</Link>
          <Link to="/login" className="hover:text-foreground transition-colors">{t("footerRegister")}</Link>
        </div>
      </div>
    </footer>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <HeroSection />

      <section id="demo" className="px-6 pb-24 bg-gradient-to-b from-muted/30 to-background">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl overflow-hidden border border-border shadow-2xl">
            <HeroDemo />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            <DemoCaption />
          </p>
        </div>
      </section>

      <FeaturesSection />
      <HowItWorksSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
}

function DemoCaption() {
  const { lang } = useLanguage();
  return <>{(T[lang as Lang] ?? T.en).demoCaption}</>;
}
