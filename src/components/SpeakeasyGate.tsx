import { useState } from 'react';

const SHOP = 'https://instinctinkidentity.com';
const products = [
  {
    title: 'Iguana Sombrero Crewneck',
    price: '$45.99',
    href: `${SHOP}/products/iguana-sombrero-crewneck-sweatshirt-mexican-desert-graphic-pullover`,
    image: 'https://cdn.shopify.com/s/files/1/1012/5767/5061/files/7450404986654957836_2048.jpg?v=1790826038',
  },
  {
    title: 'Wolf & Leopard Towel',
    price: '$42.80',
    href: `${SHOP}/products/wolf-leopard-black-white-graphic-beach-towel`,
    image: 'https://cdn.shopify.com/s/files/1/1012/5767/5061/files/4023154052553115207_2048.jpg?v=1790826047',
  },
  {
    title: 'Black Tiger Leggings',
    price: '$37.13',
    href: `${SHOP}/products/black-tiger`,
    image: 'https://cdn.shopify.com/s/files/1/1012/5767/5061/files/all-over-print-yoga-leggings-white-front-6a727ed0a82de.jpg?v=1785888485',
  },
];

export function SpeakeasyGate({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(() => sessionStorage.getItem('sistrum-door') === 'open');

  const enter = () => {
    sessionStorage.setItem('sistrum-door', 'open');
    setOpen(true);
  };

  if (open) return <>{children}</>;

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="flex items-center justify-between border-b border-[#ececec] px-6 py-5 text-[11px] uppercase tracking-[0.28em] md:px-9">
        <div className="font-serif text-[26px] normal-case tracking-[0.12em]">
          In
          <button
            type="button"
            aria-label="Enter"
            onClick={enter}
            className="inline cursor-text border-0 bg-transparent p-0 font-serif text-[26px] tracking-[0.12em] text-inherit"
          >
            s
          </button>
          tinct Ink
        </div>
        <nav className="hidden gap-6 text-black/55 md:flex">
          <a href={SHOP}>Shop</a>
          <a href={SHOP}>Originals</a>
          <a href={SHOP}>About</a>
        </nav>
      </header>
      <section className="grid border-b border-[#ececec] md:grid-cols-2">
        <div className="flex flex-col justify-end px-6 py-12 md:px-12 md:py-20">
          <p className="mb-4 text-[11px] uppercase tracking-[0.32em]">Original art. Everyday expression.</p>
          <h1 className="mb-4 font-serif text-6xl leading-[0.88] md:text-8xl">Wear your instinct.</h1>
          <p className="mb-7 max-w-sm text-black/55">Black and white pieces from Instinct Ink Identity. The music is not on this floor.</p>
          <a href={SHOP} className="w-fit border border-black px-5 py-3.5 text-[11px] uppercase tracking-[0.16em]">Shop the edit</a>
        </div>
        <a href={`${SHOP}/products/retro-camera-pattern-tee-vintage-film-camera-graphic-t-shirt`}>
          <img
            src="https://cdn.shopify.com/s/files/1/1012/5767/5061/files/7734165816021752780_2048.jpg?v=1788320026"
            alt="Retro Camera Tee"
            className="h-full min-h-80 w-full object-cover"
          />
        </a>
      </section>
      <section className="grid md:grid-cols-3">
        {products.map((product) => (
          <a key={product.href} href={product.href} className="border-b border-r border-[#ececec]">
            <img src={product.image} alt={product.title} className="aspect-square w-full object-cover" />
            <p className="px-4 py-4 text-sm">{product.title}<span className="mt-1 block text-black/55">{product.price}</span></p>
          </a>
        ))}
      </section>
    </div>
  );
}
