import React, { useEffect, useState } from 'react';
import {
  Headphones,
  Smartphone,
  Watch,
  Laptop,
  Keyboard,
  Zap,
  ShoppingBag,
  Shirt,
  Footprints,
  Armchair,
  Utensils,
  Sparkles,
  Dumbbell,
  Bike,
  Book,
  Briefcase,
  Gift,
  Camera,
  Shield,
  MousePointer,
} from 'lucide-react';

export interface ProductImageProps {
  productId?: string;
  src?: string;
  alt: string;
  category?: string;
  productType?: string;
  className?: string;
  imageClassName?: string;
}

/**
 * Strict 1-to-1 product-ID-to-verified-image registry shared across ProductCard,
 * ProductDetailsModal, and ComparisonDrawer.
 * Every entry maps a specific catalogue product ID to its own unique visually verified
 * image URL. Products not in this map intentionally resolve to '' and render a
 * consistent neutral local placeholder with descriptive alt text.
 */
export const PRODUCT_ID_TO_VERIFIED_URL: Record<string, { url: string; productType: string }> = {
  'auto-honda-sp125': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/43482/sp-125-right-side-view-8.jpeg?isig=0',
    productType: 'motorcycle',
  },
  'auto-re-hunter-350': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/201293/hunter-350-right-side-view-15.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-tvs-raider-125': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/103183/raider-125-right-side-view-12.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-bajaj-pulsar-ns125': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/57695/pulsar-ns125-right-side-view-8.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-yamaha-fzs-fi-v4': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/141961/fzs-fi-v4-right-side-view-6.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-ktm-duke-390': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/148323/390-duke-r-right-side-view-14.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-re-classic-350': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Royal_Enfield_Classic_350.jpg/960px-Royal_Enfield_Classic_350.jpg',
    productType: 'motorcycle',
  },
  'auto-axor-apex-helmet': {
    url: 'https://images.unsplash.com/photo-1590506995460-d0d9892b54da?w=600&auto=format&fit=crop&q=80',
    productType: 'helmet',
  },
  'hp-apple-airpods-pro-2': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/AirPods_Pro_%282nd_generation%29.jpg/960px-AirPods_Pro_%282nd_generation%29.jpg',
    productType: 'earbuds',
  },
  'hp-realme-buds-t300': {
    url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80',
    productType: 'earbuds',
  },
  'hp-oneplus-nord-buds-2r': {
    url: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&auto=format&fit=crop&q=80',
    productType: 'earbuds',
  },
  'hp-jbl-tune-760nc': {
    url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    productType: 'headphones',
  },
  'hp-sony-wh-1000xm4': {
    url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=600&auto=format&fit=crop&q=80',
    productType: 'headphones',
  },
  'hp-sennheiser-hd-450se': {
    url: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600&auto=format&fit=crop&q=80',
    productType: 'headphones',
  },
  'hp-sony-wh-ch720n': {
    url: 'https://images.unsplash.com/photo-1577174881658-0f30ed549adc?w=600&auto=format&fit=crop&q=80',
    productType: 'headphones',
  },
  'phone-nothing-phone-2a': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Nothing_phone_%282a%29.jpg/960px-Nothing_phone_%282a%29.jpg',
    productType: 'smartphone',
  },
  'phone-google-pixel-8a': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Pixel_8a.jpg/960px-Pixel_8a.jpg',
    productType: 'smartphone',
  },
  'phone-apple-iphone-15': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Back_of_iPhone_15.jpg/960px-Back_of_iPhone_15.jpg',
    productType: 'smartphone',
  },
  'phone-samsung-galaxy-s24-ultra': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/SAMSUNG_Galaxy_S24_Ultra.jpg/960px-SAMSUNG_Galaxy_S24_Ultra.jpg',
    productType: 'smartphone',
  },
  'phone-poco-c65': {
    url: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=80',
    productType: 'smartphone',
  },
  'phone-redmi-13c-5g': {
    url: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=600&auto=format&fit=crop&q=80',
    productType: 'smartphone',
  },
  'phone-samsung-galaxy-a35-5g': {
    url: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&auto=format&fit=crop&q=80',
    productType: 'smartphone',
  },
  'sw-apple-watch-series-9': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Apple_Watch_Series_9_%28cropped%29.jpg/960px-Apple_Watch_Series_9_%28cropped%29.jpg',
    productType: 'smartwatch',
  },
  'sw-samsung-galaxy-watch-6': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Samsung_Galaxy_Watch_6.jpg/960px-Samsung_Galaxy_Watch_6.jpg',
    productType: 'smartwatch',
  },
  'sw-garmin-forerunner-55': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Garmin_Forerunner_55.jpg/960px-Garmin_Forerunner_55.jpg',
    productType: 'smartwatch',
  },
  'sw-noise-colorfit-pulse-3': {
    url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
    productType: 'smartwatch',
  },
  'sw-amazfit-bip-5': {
    url: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&auto=format&fit=crop&q=80',
    productType: 'smartwatch',
  },
  'lap-apple-macbook-air-m2': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/M2_Macbook_Air_Midnight_model_-_1.jpg/960px-M2_Macbook_Air_Midnight_model_-_1.jpg',
    productType: 'laptop',
  },
  'lap-asus-vivobook-16x-creator': {
    url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80',
    productType: 'laptop',
  },
  'lap-apple-macbook-air-m3-16gb': {
    url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80',
    productType: 'laptop',
  },
  'lap-hp-victus-gaming-ryzen-5': {
    url: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&auto=format&fit=crop&q=80',
    productType: 'laptop',
  },
  'km-logitech-k380-multi-device': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Logitech_K380_CJK_Keyboard.jpg/960px-Logitech_K380_CJK_Keyboard.jpg',
    productType: 'keyboard',
  },
  'km-razer-deathadder-essential': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Razer_DeathAdder_Elite-front_oblique-ar_16to10-fs_PNr%C2%B00465.jpg/960px-Razer_DeathAdder_Elite-front_oblique-ar_16to10-fs_PNr%C2%B00465.jpg',
    productType: 'mouse',
  },
  'km-keychron-k2-v2-wireless': {
    url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
    productType: 'keyboard',
  },
  'km-cosmic-byte-cb-gk-16': {
    url: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=600&auto=format&fit=crop&q=80',
    productType: 'keyboard',
  },
  'km-logitech-mx-master-3s': {
    url: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop&q=80',
    productType: 'mouse',
  },
  'km-logitech-pebble-m350-mouse': {
    url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&auto=format&fit=crop&q=80',
    productType: 'mouse',
  },
  'pb-belkin-boostcharge-30w-usbc-adapter': {
    url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80',
    productType: 'wall-charger',
  },
  'fash-zara-cotton-tee': {
    url: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=600&auto=format&fit=crop&q=80',
    productType: 't-shirt',
  },
  'fash-fabindia-cotton-kurta': {
    url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80',
    productType: 'kurta',
  },
  'foot-nike-revolution-6': {
    url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
    productType: 'running-shoes',
  },
  'foot-puma-velocity-nitro': {
    url: 'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=600&auto=format&fit=crop&q=80',
    productType: 'running-shoes',
  },
  'foot-decathlon-kalenji': {
    url: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop&q=80',
    productType: 'running-shoes',
  },
  'foot-nike-air-monarch-4': {
    url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&auto=format&fit=crop&q=80',
    productType: 'training-shoes',
  },
  'foot-converse-chuck-taylor': {
    url: 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=600&auto=format&fit=crop&q=80',
    productType: 'sneakers',
  },
  'foot-woodland-leather-boots': {
    url: 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600&auto=format&fit=crop&q=80',
    productType: 'boots',
  },
  'furn-green-soul-jupiter': {
    url: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=600&auto=format&fit=crop&q=80',
    productType: 'office-chair',
  },
  'furn-greensoul-wall-table': {
    url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&auto=format&fit=crop&q=80',
    productType: 'study-table',
  },
  'kitch-instant-pot-duo-6qt': {
    url: 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=600&auto=format&fit=crop&q=80',
    productType: 'pressure-cooker',
  },
  'kitch-bajaj-mixer-grinder': {
    url: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&auto=format&fit=crop&q=80',
    productType: 'mixer-grinder',
  },
  'kitch-milton-spotzero-cookware': {
    url: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=600&auto=format&fit=crop&q=80',
    productType: 'cookware-set',
  },
  'beauty-minimalist-sunscreen-spf50': {
    url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&auto=format&fit=crop&q=80',
    productType: 'sunscreen',
  },
  'beauty-minimalist-salicylic-facewash': {
    url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80',
    productType: 'facewash',
  },
  'beauty-philips-hair-dryer': {
    url: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=600&auto=format&fit=crop&q=80',
    productType: 'hair-dryer',
  },
  'sport-boldfit-yoga-mat': {
    url: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&auto=format&fit=crop&q=80',
    productType: 'yoga-mat',
  },
  'sport-kakss-adjustable-dumbbells': {
    url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&auto=format&fit=crop&q=80',
    productType: 'dumbbell',
  },
  'sport-yonex-badminton-racket': {
    url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&auto=format&fit=crop&q=80',
    productType: 'badminton-racket',
  },
  'sport-firefox-bad-attitude-cycle': {
    url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&auto=format&fit=crop&q=80',
    productType: 'bicycle',
  },
  'sport-nivia-storm-football': {
    url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop&q=80',
    productType: 'football',
  },
  'sport-milton-1l-bottle': {
    url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80',
    productType: 'water-bottle',
  },
  'trav-mokobara-transit-backpack': {
    url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',
    productType: 'backpack',
  },
  'book-atomic-habits': {
    url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
    productType: 'book',
  },
  'trav-american-tourister-ivy': {
    url: 'https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?w=600&auto=format&fit=crop&q=80',
    productType: 'trolley-luggage',
  },
  'gift-giva-silver-necklace': {
    url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop&q=80',
    productType: 'necklace',
  },
  'gift-titan-raga-rosegold-watch': {
    url: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80',
    productType: 'analog-watch',
  },
  'gift-plum-vanilla-fragrance': {
    url: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&auto=format&fit=crop&q=80',
    productType: 'perfume',
  },
  'gift-titan-skinn-perfume-duo': {
    url: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=600&auto=format&fit=crop&q=80',
    productType: 'perfume',
  },
  'gift-fossil-leather-wallet': {
    url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80',
    productType: 'wallet',
  },
  'auto-re-himalayan-450-slate-poppy-blue': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/110431/himalayan-right-side-view-8.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-re-meteor-350-fireball-red': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/210213/meteor-350-right-side-view-9.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-re-continental-gt-650-apex-grey': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/49656/continental-gt-right-side-view-13.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-re-super-meteor-650-astral-black': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/108885/super-meteor-750-right-side-view-7.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-tvs-apache-rtr-160-4v-special-edition': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/97549/apache-rtr-160-4v-right-side-view-9.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-tvs-apache-rtr-200-4v-dual-abs': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/204536/apache-200-right-side-view-5.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-tvs-ronin-225-special-edition': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/227610/new-ronin-right-side-view-9.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-yamaha-mt-15-v2-deluxe-cyber-green': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/115871/mt-15-right-side-view-4.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-yamaha-yzf-r15-v4-racing-blue': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/209893/r15-right-side-view-3.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-bajaj-pulsar-n250-dual-abs': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/178257/pulsar-n250-right-side-view-3.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-bajaj-dominar-400-touring-edition': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/217059/dominar-400-right-side-view-11.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-triumph-speed-400-phantom-black': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/210611/speed-400-right-side-view-5.jpeg?isig=0',
    productType: 'motorcycle',
  },
  'auto-triumph-scrambler-400x-matt-khaki': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/210613/scrambler-400-x-right-side-view.jpeg?isig=0',
    productType: 'motorcycle',
  },
  'auto-honda-cb350-hness-dlx-pro': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/200501/cb350-right-side-view-9.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-ather-450x-gen-3-pro-electric-scooter': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/196337/450x-right-side-view-2.png?isig=0',
    productType: 'scooter',
  },
  'auto-ola-s1-pro-gen-2-electric-scooter': {
    url: 'https://imgd.aeplcdn.com/1280x720/n/cw/ec/196991/s1-pro-left-side-view-3.png?isig=0',
    productType: 'scooter',
  },
  'auto-honda-activa-6g-hsmart-premium': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/44686/activa-6g-right-side-view-2.png?isig=0',
    productType: 'scooter',
  },
  'auto-tvs-ntorq-125-race-xp': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/102709/ntorq-125-right-side-view-3.png?isig=0',
    productType: 'scooter',
  },
  'auto-suzuki-access-125-ride-connect-edition': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/188491/access-125-right-side-view-20.png?isig=0',
    productType: 'scooter',
  },
  'auto-yamaha-aerox-155-version-s-keyless': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/103803/aerox-155-right-side-view-5.png?isig=0',
    productType: 'scooter',
  },
  'auto-bajaj-chetak-premium-electric-scooter': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/194471/chetak-right-side-view-4.png?isig=0',
    productType: 'scooter',
  },
  'foot-nike-air-force-1-07': {
    url: 'https://www.carnivalbkk.com/media/catalog/product/2/2/2288-111-2_3_4_1_1_1.jpg',
    productType: 'sneakers',
  },
  'foot-adidas-samba-og-white': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Adidas_Samba_sneakers%2C_Originals_branch.JPG',
    productType: 'sneakers',
  },
  'foot-adidas-superstar-core-black-white': {
    url: 'https://i.ebayimg.com/images/g/-bgAAOSwxKBfzdE5/s-l1600.jpg',
    productType: 'sneakers',
  },
  'foot-air-jordan-1-low-chicago': {
    url: 'https://static.ftshp.digital/img/p/6/6/8/2/4/5/668245.jpg',
    productType: 'sneakers',
  },
  'foot-vans-old-skool-black-white': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Vans_shoes_talgraf777.jpg',
    productType: 'sneakers',
  },
  'foot-nike-blazer-mid-77-vintage-white-black': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/74/2012_Nike_Blazers.JPG',
    productType: 'sneakers',
  },
  'foot-nike-air-max-90-infrared': {
    url: 'https://sneakernews.com/wp-content/uploads/2023/11/nike-air-max-90-gore-tex-infrared-fd5810-101-3.jpg',
    productType: 'sneakers',
  },
  'foot-new-balance-574-core-grey': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/67/New_Balance_574_enfants.jpg',
    productType: 'sneakers',
  },
  'hp-apple-airpods-max-space-grey': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Apple_airpods_max_1.jpg',
    productType: 'headphones',
  },
  'sw-apple-watch-ultra-2-gps-cellular': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Apple_Watch_Ultra_-_2.jpg',
    productType: 'smartwatch',
  },
  'phone-apple-iphone-15-pro-max': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/19/Apple_iPhone_15_Pro.jpg',
    productType: 'smartphone',
  },
  'lap-dell-xps-13-plus': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/21/DELL_XPS_13_and_15_%2837080596413%29.jpg',
    productType: 'laptop',
  },
  'beauty-dyson-supersonic-hair-dryer-iron-fuchsia': {
    url: 'https://bf1af2.a-cdn.akinoncloud.com/products/2024/09/06/42890/94b71038-5adb-4b58-8e8c-1810f8e1b828.jpg',
    productType: 'hair-dryer',
  },
  'kitch-philips-airfryer-xxl-hd9650': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Airfryer_Convert.jpg',
    productType: 'air-fryer',
  },
  'fash-levis-denim-jacket': {
    url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=600&auto=format&fit=crop&q=80',
    productType: 'jacket',
  },
  'fash-hm-relaxed-black-hoodie': {
    url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&auto=format&fit=crop&q=80',
    productType: 'hoodie',
  },
  'fash-stussy-basic-hoodie-black': {
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    productType: 'hoodie',
  },
  'fash-champion-reverse-weave-hoodie-oxford-grey': {
    url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&auto=format&fit=crop&q=80',
    productType: 'hoodie',
  },
  'fash-zara-heavyweight-oversized-tee-white': {
    url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
    productType: 't-shirt',
  },
  'fash-uniqlo-airism-cotton-oversized-crew-tee': {
    url: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&auto=format&fit=crop&q=80',
    productType: 't-shirt',
  },
  'fash-the-north-face-1996-retro-nuptse-jacket': {
    url: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=600&auto=format&fit=crop&q=80',
    productType: 'jacket',
  },
  'fash-alpha-industries-ma1-bomber-jacket': {
    url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=80',
    productType: 'jacket',
  },
  'foot-nike-dunk-low-retro-panda': {
    url: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=600&auto=format&fit=crop&q=80',
    productType: 'sneakers',
  },
  'foot-new-balance-550-white-green': {
    url: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=600&auto=format&fit=crop&q=80',
    productType: 'sneakers',
  },
  'foot-adidas-duramo-sl': {
    url: 'https://images.unsplash.com/photo-1562183241-b937e95585b6?w=600&auto=format&fit=crop&q=80',
    productType: 'running-shoes',
  },
  'foot-asics-gel-contend-8': {
    url: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&auto=format&fit=crop&q=80',
    productType: 'running-shoes',
  },
  'beauty-neutrogena-dry-touch': {
    url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&auto=format&fit=crop&q=80',
    productType: 'sunscreen',
  },
  'beauty-cerave-hydrating-facial-cleanser': {
    url: 'https://images.unsplash.com/photo-1556228852-6d35a585d566?w=600&auto=format&fit=crop&q=80',
    productType: 'facewash',
  },
  'beauty-the-ordinary-niacinamide-10-zinc-1': {
    url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop&q=80',
    productType: 'facewash',
  },
  'furn-featherlite-optima': {
    url: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=600&auto=format&fit=crop&q=80',
    productType: 'office-chair',
  },
  'furn-urbanladder-clifton-desk': {
    url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&auto=format&fit=crop&q=80',
    productType: 'study-table',
  },
  'kitch-philips-airfryer-hd9200': {
    url: 'https://images.unsplash.com/photo-1585237672814-8f85a8118bf6?w=600&auto=format&fit=crop&q=80',
    productType: 'air-fryer',
  },
  'kitch-le-creuset-round-dutch-oven-cerise-24cm': {
    url: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=600&auto=format&fit=crop&q=80',
    productType: 'cookware-set',
  },
  'sport-hydro-flask-32oz-wide-mouth-bottle': {
    url: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=600&auto=format&fit=crop&q=80',
    productType: 'water-bottle',
  },
  'auto-re-bullet-350-military-black': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/127499/bullet-right-side-view-14.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-re-guerrilla-450-smoke-silver': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/219872/guerrilla-450-right-side-view-3.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-re-scram-411-silver-spirit': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/99489/scram-411-right-side-view-13.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-ktm-rc-200-gp-edition': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/146607/rc-300-right-side-view-2.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-ktm-250-adventure-electronic-orange': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/189671/250-adventure-2025-right-side-view.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-ktm-390-adventure-spoke-wheel': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/220882/390-adventure-right-side-view-4.png?isig=0',
    productType: 'motorcycle',
  },
  'auto-tvs-iqube-st-electric-scooter': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/202879/iqube-right-side-view-55.jpeg?isig=0',
    productType: 'scooter',
  },
  'auto-vespa-sxl-150-racing-sixties': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/136991/sxl-150-right-side-view-7.png?isig=0',
    productType: 'scooter',
  },
  'auto-aprilia-sr-160-race-edition': {
    url: 'https://imgd.aeplcdn.com/664x374/n/cw/ec/112667/sr-160-right-side-view-4.png?isig=0',
    productType: 'scooter',
  },
  'sport-trek-marlin-7-gen-3-mountain-bike': {
    url: 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=600&auto=format&fit=crop&q=80',
    productType: 'bicycle',
  },
  'sport-scott-sub-cross-40-hybrid-bicycle': {
    url: 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=600&auto=format&fit=crop&q=80',
    productType: 'bicycle',
  },
  'wf-kurti-biba-jaipuri-cotton-straight': {
    url: 'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=600&auto=format&fit=crop&q=80',
    productType: 'kurta',
  },
  'wf-kurti-fabindia-indigo-dabu-short': {
    url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80',
    productType: 'kurta',
  },
  'wf-kurti-w-mustard-kashmiri-anarkali': {
    url: 'https://images.unsplash.com/photo-1605763240000-7e93b172d754?w=600&auto=format&fit=crop&q=80',
    productType: 'kurta',
  },
  'wf-kurti-libas-crimson-floral-aline': {
    url: 'https://media.landmarkshops.in/cdn-cgi/image/h=831,w=615,q=85,fit=cover/lifestyle-new/1000016546662-Red-Red-1000016546662_01-2100.jpg',
    productType: 'kurta',
  },
  'wf-kurti-aurelia-ruby-sanganeri-belted-kurti': {
    url: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_75,w_1080/v1/assets/images/19335118/2022/8/1/dde018c4-270b-4417-ae4f-08b5d55534251659366073041AURELIAWomenRedEthnicMotifsEmbroideredFlaredSleevesThreadWor1.jpg',
    productType: 'kurta',
  },
  'wf-kurti-global-desi-chambray-embroidered-tunic': {
    url: 'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=600&auto=format&fit=crop&q=80',
    productType: 'kurta',
  },
  'wf-kurti-rangriti-powder-blue-khadi-striped': {
    url: 'https://images.unsplash.com/photo-1589810635657-232948472d98?w=600&auto=format&fit=crop&q=80',
    productType: 'kurta',
  },
  'wf-kurti-ada-lucknowi-chikankari-mulmul-white': {
    url: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=600&auto=format&fit=crop&q=80',
    productType: 'kurta',
  },
  'wf-kurti-anouk-terracotta-handloom-collection': {
    url: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_100,w_1080/v1/assets/images/12135146/2020/12/15/2c4f4389-c72f-4307-8346-dc8f9c87c0721608036732221-Anouk-Women-Kurtas-8461608036730179-1.jpg',
    productType: 'kurta',
  },
  'wf-kurti-jaypore-ivory-chanderi-tunic': {
    url: 'https://imagescdn.jaypore.com/img/app/product/3/39602777-12137681.jpg',
    productType: 'kurta',
  },
  'wf-kurti-soch-pastel-chanderi-office-kurta': {
    url: 'https://shopforaurelia.com/cdn/shop/files/A15648-608125_1.jpg?v=1753187050&width=1500',
    productType: 'kurta',
  },
  'wf-kurti-melange-cinnamon-winter-woolen-kurti': {
    url: 'https://apisap.fabindia.com/medias/20248318-01.jpg?context=bWFzdGVyfGltYWdlc3w4OTYwOXxpbWFnZS9qcGVnfGFEQmhMMmd3WWk4eE16VTFNRGswT1RVeU9ETTNOREl2TWpBeU5EZ3pNVGhmTURFdWFuQm58ODg5NGJmMWUzY2VlOTE1YTdhOTU5OTM3NGY2YWM0MWNjOTI2MTRlZWQ1MWM2NGZlMjhkZjA1ZDc2ZmJiZDM0Zg',
    productType: 'kurta',
  },
  'wf-kurti-vishudh-ochre-geometric-knit-kurti': {
    url: 'https://images.unsplash.com/photo-1475180098004-ca77a66827be?w=600&auto=format&fit=crop&q=80',
    productType: 'kurta',
  },
  'wf-kurti-aks-crimson-relaxed-khadi-tunic': {
    url: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_100,w_1080/v1/assets/images/13165410/2020/12/18/99d44fb8-0175-41e0-8a0b-1738490752aa1608269280950-HERENOW-Women-Red-Pure-Cotton-Solid-Straight-Kurta-761160826-1.jpg',
    productType: 'kurta',
  },
  'wf-kurti-taavi-ajrakh-botanical-printed-kurta': {
    url: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_75,w_1080/v1/assets/images/30964913/2025/1/7/8e36c2e1-0944-4a16-81c1-b2be1fd0377a1736235270339-Taavi-Women-Kurtis-8131736235269775-1.jpg',
    productType: 'kurta',
  },
  'wf-saree-nalli-kanjeevaram-purple-gold-zari': {
    url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
    productType: 'saree',
  },
  'wf-saree-rmkv-rani-pink-sunset-silk': {
    url: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&auto=format&fit=crop&q=80',
    productType: 'saree',
  },
  'wf-saree-taneira-banarasi-kadhwa-black-gold': {
    url: 'https://images.unsplash.com/photo-1610030469668-8e9f641aaf27?w=600&auto=format&fit=crop&q=80',
    productType: 'saree',
  },
  'wf-saree-suta-royal-blue-floral-mulmul': {
    url: 'https://images.unsplash.com/photo-1610030469978-6bb537f3b982?w=600&auto=format&fit=crop&q=80',
    productType: 'saree',
  },
  'wf-saree-karagiri-rust-orange-banarasi-tussar': {
    url: 'https://images.unsplash.com/photo-1610030468706-9a6dbad49b0a?w=600&auto=format&fit=crop&q=80',
    productType: 'saree',
  },
  'wf-saree-satya-paul-ruby-pre-draped-cocktail': {
    url: 'https://i.pinimg.com/originals/e7/d3/87/e7d38778e0a24fb077ff3c4fbd8d71f7.jpg',
    productType: 'saree',
  },
  'wf-saree-kalki-emerald-pleated-georgette': {
    url: 'https://i.pinimg.com/736x/ee/cc/12/eecc12429f660bcb18802fb94850b623.jpg',
    productType: 'saree',
  },
  'wf-saree-meena-bazaar-blush-organza-floral': {
    url: 'https://meenabazaar.com/cdn/shop/files/MBGULABOPRINT4116PINK_1800x1800.jpg?v=1774000632',
    productType: 'saree',
  },
  'wf-saree-indya-ivory-botanical-chiffon-drape': {
    url: 'https://img.faballey.com/images/Product/ILS00780Z/d4.jpg',
    productType: 'saree',
  },
  'wf-saree-chhabra555-powder-blue-chiffon': {
    url: 'https://www.frontierraas.com/pub/media/catalog/product/f/r/fr12125995_5_.jpg',
    productType: 'saree',
  },
  'wf-saree-triveni-maroon-bandhani-printed': {
    url: 'https://i.pinimg.com/originals/0c/c0/a1/0cc0a19bab19234e67616cfe133acc94.jpg',
    productType: 'saree',
  },
  'wf-saree-mimosa-crimson-silk-blend-festive': {
    url: 'https://assets0.mirraw.com/images/11785891/image_zoom.jpeg?1693053137',
    productType: 'saree',
  },
  'wf-ethnic-biba-rust-kurta-palazzo-set': {
    url: 'https://images.unsplash.com/photo-1614251055880-ee96e4803393?w=600&auto=format&fit=crop&q=80',
    productType: 'ethnic-set',
  },
  'wf-ethnic-libas-blush-pink-kurta-trouser-set': {
    url: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_100,w_1080/v1/assets/images/productimage/2020/10/24/f71909e5-20ec-46c2-911e-cdd7ea96bcd01603491605150-1.jpg',
    productType: 'ethnic-set',
  },
  'wf-ethnic-ritu-kumar-plum-reception-anarkali-gown': {
    url: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80',
    productType: 'ethnic-set',
  },
  'wf-ethnic-w-striped-palazzo-fusion-suit-set': {
    url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&auto=format&fit=crop&q=80',
    productType: 'ethnic-set',
  },
  'wf-ethnic-global-desi-champagne-pleated-skirt-set': {
    url: 'https://images.unsplash.com/photo-1551163943-3f6a855d1153?w=600&auto=format&fit=crop&q=80',
    productType: 'ethnic-set',
  },
  'wf-ethnic-house-of-pataudi-ivory-suitsuit': {
    url: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_75,w_1080/v1/assets/images/16278528/2022/8/1/df40ecba-a46c-4668-865c-0ea2935f18911659337293745-House-of-Pataudi-Women-Kurta-Sets-8271659337292975-1.jpg',
    productType: 'ethnic-set',
  },
  'wf-ethnic-indya-emerald-lace-choli-lehenga-top': {
    url: 'https://i.pinimg.com/originals/2c/e7/30/2ce73067dbce1aa4609f3d67498ab0f6.jpg',
    productType: 'ethnic-set',
  },
  'wf-ethnic-aurelia-mustard-haldi-coord-set': {
    url: 'https://assets.myntassets.com/h_200,w_200,c_fill,g_auto/h_1440,q_100,w_1080/v1/assets/images/18694104/2022/12/11/8f0713f9-7bab-483c-8a77-db3590a2fb0b1670739793316AURELIAWomenYellowEthnicMotifsPrintedKurtaSetWithDupatta1.jpg',
    productType: 'ethnic-set',
  },
  'wf-west-mango-white-schiffli-offshoulder-dress': {
    url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&auto=format&fit=crop&q=80',
    productType: 'western-wear',
  },
  'wf-west-zara-plaid-belted-midi-skirt': {
    url: 'https://images.unsplash.com/photo-1550639525-c97d455acf70?w=600&auto=format&fit=crop&q=80',
    productType: 'western-wear',
  },
  'wf-west-levis-711-light-wash-skinny-jeans': {
    url: 'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=600&auto=format&fit=crop&q=80',
    productType: 'western-wear',
  },
  'wf-west-only-distressed-patched-mom-jeans': {
    url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80',
    productType: 'western-wear',
  },
  'wf-west-hm-high-waist-vintage-blue-mom-jeans': {
    url: 'https://images.unsplash.com/photo-1582418702059-97ebafb35d09?w=600&auto=format&fit=crop&q=80',
    productType: 'western-wear',
  },
  'wf-west-vero-moda-white-blouse-black-skirt': {
    url: 'https://images.unsplash.com/photo-1583846783214-7229a91b20ed?w=600&auto=format&fit=crop&q=80',
    productType: 'western-wear',
  },
  'wf-west-and-olive-belted-safari-playsuit': {
    url: 'https://images.unsplash.com/photo-1618932260643-eee4a2f652a6?w=600&auto=format&fit=crop&q=80',
    productType: 'western-wear',
  },
  'wf-west-marks-spencer-white-poplin-shirt-combo': {
    url: 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=600&auto=format&fit=crop&q=80',
    productType: 'western-wear',
  },
  'wf-west-bewakoof-peace-graphic-crop-tee': {
    url: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&auto=format&fit=crop&q=80',
    productType: 'western-wear',
  },
  'wf-west-wrangler-dark-indigo-straight-jeans': {
    url: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80',
    productType: 'western-wear',
  },
  'wf-outer-burberry-style-camel-belted-trench-coat': {
    url: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600&auto=format&fit=crop&q=80',
    productType: 'womens-outerwear',
  },
  'wf-outer-van-heusen-grey-plaid-double-breasted-blazer': {
    url: 'https://images.unsplash.com/photo-1608234808654-2a8875faa7fd?w=600&auto=format&fit=crop&q=80',
    productType: 'womens-outerwear',
  },
  'wf-outer-mango-emerald-navy-tartan-wool-coat': {
    url: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=600&auto=format&fit=crop&q=80',
    productType: 'womens-outerwear',
  },
  'wf-outer-zara-black-faux-leather-biker-jacket': {
    url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80',
    productType: 'womens-outerwear',
  },
  'wf-outer-fabindia-ivory-handknit-fringed-cape-shawl': {
    url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop&q=80',
    productType: 'womens-outerwear',
  },
};


const PROMPT_PRODUCT_ID_ALIASES: Record<string, string> = {
  "wf-kurti-aks-crimson-handspun-cotton-tunic": "wf-kurti-aks-crimson-relaxed-khadi-tunic",
  "wf-kurti-jaypore-ivory-linen-cotton-tunic": "wf-kurti-jaypore-ivory-chanderi-tunic",
  "wf-kurti-taavi-ajrakh-bagru-printed-cotton": "wf-kurti-taavi-ajrakh-botanical-printed-kurta",
  "wf-kurti-soch-powder-blue-collared-cotton-silk": "wf-kurti-soch-pastel-chanderi-office-kurta",
  "wf-kurti-melange-cinnamon-textured-winter": "wf-kurti-melange-cinnamon-winter-woolen-kurti",
  "wf-kurti-anouk-terracotta-handloom-straight": "wf-kurti-anouk-terracotta-handloom-collection",
  "wf-kurti-aurelia-ruby-red-sanganeri-pleated": "wf-kurti-aurelia-ruby-sanganeri-belted-kurti",
  "wf-kurti-libas-crimson-jaipuri-floral-aline": "wf-kurti-libas-crimson-floral-aline",
  "wf-saree-kalki-emerald-pleated-georgette-drape": "wf-saree-kalki-emerald-pleated-georgette",
  "wf-saree-satya-paul-ruby-red-cocktail-drape": "wf-saree-satya-paul-ruby-pre-draped-cocktail",
  "wf-saree-chhabra555-powder-blue-chiffon-piping": "wf-saree-chhabra555-powder-blue-chiffon",
  "wf-saree-meena-bazaar-blush-pink-organza-ruffle": "wf-saree-meena-bazaar-blush-organza-floral",
  "wf-saree-triveni-maroon-bandhani-georgette": "wf-saree-triveni-maroon-bandhani-printed",
  "wf-saree-mimosa-crimson-art-silk-zari": "wf-saree-mimosa-crimson-silk-blend-festive",
  "wf-saree-indya-ivory-rose-chiffon-drape": "wf-saree-indya-ivory-botanical-chiffon-drape",
  "wf-ethnic-libas-blush-pink-kurta-cigarette-pants": "wf-ethnic-libas-blush-pink-kurta-trouser-set",
  "wf-ethnic-aurelia-haldi-yellow-lounge-coord": "wf-ethnic-aurelia-mustard-haldi-coord-set",
  "wf-ethnic-pataudi-ivory-bandhgala-suit-set": "wf-ethnic-house-of-pataudi-ivory-suitsuit",
  "wf-ethnic-indya-emerald-chikankari-choli-skirt": "wf-ethnic-indya-emerald-lace-choli-lehenga-top",
  "shoe-jordan-1-low-chicago": "foot-air-jordan-1-low-chicago",
  "shoe-nike-af1-white": "foot-nike-air-force-1-07",
  "shoe-adidas-superstar": "foot-adidas-superstar-core-black-white",
  "shoe-nike-air-max-90": "foot-nike-air-max-90-infrared",
  "bpc-dyson-supersonic-hd07": "beauty-dyson-supersonic-hair-dryer-iron-fuchsia"
};

const VISUALLY_VERIFIED_URLS_BY_TYPE: Record<string, string[]> = {};
for (const entry of Object.values(PRODUCT_ID_TO_VERIFIED_URL)) {
  if (!VISUALLY_VERIFIED_URLS_BY_TYPE[entry.productType]) {
    VISUALLY_VERIFIED_URLS_BY_TYPE[entry.productType] = [];
  }
  VISUALLY_VERIFIED_URLS_BY_TYPE[entry.productType].push(entry.url);
}

const ALL_VERIFIED_URLS = new Set<string>(
  Object.values(PRODUCT_ID_TO_VERIFIED_URL).map((e) => e.url)
);

export function inferClientProductType(name: string, category?: string, productType?: string): string {
  if (productType && productType !== 'unknown') return productType.toLowerCase();
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();

  if (c === 'automotive') {
    if (n.includes('dash cam') || n.includes('dashcam') || n.includes('camera')) return 'dash-cam';
    if (n.includes('helmet')) return 'helmet';
    if (n.includes('scooter') || n.includes('activa') || n.includes('jupiter') || n.includes('access 125') || n.includes('chetak')) return 'scooter';
    return 'motorcycle';
  }
  if (n.includes('dash cam') || n.includes('dashcam')) return 'dash-cam';
  if (n.includes('helmet')) return 'helmet';

  if (c === 'kurtis-kurtas') return 'kurta';
  if (c === 'sarees') return 'saree';
  if (c === 'ethnic-sets-festive-wear') return 'ethnic-set';
  if (c === 'western-wear') return 'western-wear';
  if (c === 'womens-outerwear') return 'womens-outerwear';
  if (c === 'fashion') {
    if (n.includes('hoodie') || n.includes('sweatshirt')) return 'hoodie';
    if (n.includes('jacket') || n.includes('windcheater')) return 'jacket';
    if (n.includes('kurta')) return 'kurta';
    if (n.includes('jeans')) return 'jeans';
    if (n.includes('chinos') || n.includes('trousers') || n.includes('pants')) return 'trousers';
    if (n.includes('saree')) return 'saree';
    if (n.includes('shirt') && !n.includes('t-shirt') && !n.includes('sweatshirt')) return 'shirt';
    if (n.includes('t-shirt') || n.includes('polo') || n.includes('tee')) return 't-shirt';
    return 't-shirt';
  }
  if (n.includes('hoodie') || n.includes('sweatshirt')) return 'hoodie';

  if (c === 'footwear') {
    if (n.includes('boot')) return 'boots';
    if (n.includes('slide') || n.includes('sandal') || n.includes('clog') || n.includes('flip')) return 'sandals';
    if (n.includes('sneaker') || n.includes('Chuck') || n.includes('casual') || n.includes('574') || n.includes('suede')) return 'sneakers';
    if (n.includes('training') || n.includes('gym') || n.includes('nano')) return 'training-shoes';
    return 'running-shoes';
  }
  if (n.includes('running') && n.includes('shoe')) return 'running-shoes';

  if (c === 'furniture') {
    if (n.includes('chair')) return 'office-chair';
    if (n.includes('bookshelf') || n.includes('bookcase') || n.includes('shelf')) return 'bookshelf';
    if (n.includes('table') || n.includes('desk')) return 'study-table';
    return 'office-chair';
  }

  if (c === 'kitchen-appliances') {
    if (n.includes('pressure cooker') || n.includes('super cooker') || n.includes('instant pot') || n.includes('contura') || n.includes('svachh')) return 'pressure-cooker';
    if (n.includes('air fryer') || n.includes('airfryer')) return 'air-fryer';
    if (n.includes('mixer') || n.includes('grinder') || n.includes('bullet') || n.includes('blender')) return 'mixer-grinder';
    if (n.includes('induction')) return 'induction-cooktop';
    if (n.includes('kettle')) return 'electric-kettle';
    if (n.includes('cookware')) return 'cookware-set';
    return 'pressure-cooker';
  }
  if (n.includes('pressure cooker') || n.includes('super cooker') || n.includes('instant pot')) return 'pressure-cooker';

  if (c === 'beauty-personal-care') {
    if (n.includes('sunscreen') || n.includes('spf')) return 'sunscreen';
    if (n.includes('hair dryer') || n.includes('dryer')) return 'hair-dryer';
    if (n.includes('trimmer') || n.includes('shaver') || n.includes('oneblade') || n.includes('grooming')) return 'grooming-kit';
    if (n.includes('cleanser') || n.includes('face wash') || n.includes('micellar')) return 'facewash';
    if (n.includes('moisturizer') || n.includes('lotion') || n.includes('cream') || n.includes('gel')) return 'moisturizer';
    if (n.includes('serum') || n.includes('niacinamide')) return 'serum';
    return 'sunscreen';
  }

  if (c === 'sports-fitness') {
    if (n.includes('yoga mat') || n.includes('mat')) return 'yoga-mat';
    if (n.includes('dumbbell')) return 'dumbbell';
    if (n.includes('badminton') || n.includes('racket') || n.includes('racquet')) return 'badminton-racket';
    if (n.includes('cycle') || n.includes('bicycle') || n.includes('mtb')) return 'bicycle';
    if (n.includes('football') || n.includes('soccer')) return 'football';
    if (n.includes('bottle') || n.includes('flask') || n.includes('sipper')) return 'water-bottle';
    if (n.includes('band')) return 'resistance-bands';
    if (n.includes('rope')) return 'skipping-rope';
    if (n.includes('duffel') || n.includes('duffle') || n.includes('gym bag')) return 'gym-bag';
    return 'dumbbell';
  }

  if (c === 'headphones') {
    if (n.includes('neckband') || n.includes('in-ear wireless') || n.includes('rockerz 255') || n.includes('bullets wireless')) return 'neckband';
    if (n.includes('earbuds') || n.includes('buds') || n.includes('airpods') || n.includes('tws') || n.includes('wf-') || n.includes('airdopes')) return 'earbuds';
    return 'headphones';
  }
  if (n.includes('neckband') || n.includes('rockerz 255') || n.includes('bullets wireless')) return 'neckband';
  if (n.includes('earbuds') || n.includes('airdopes') || n.includes('buds') || n.includes('tws')) return 'earbuds';
  if (n.includes('headphone') || n.includes('wh-ch') || n.includes('wh-1000') || n.includes('tune 7')) return 'headphones';

  if (c === 'smartphones') return 'smartphone';

  if (c === 'smartwatches') {
    if (n.includes('analog') || n.includes('casio') || n.includes('edifice') || n.includes('enticer') || n.includes('chronograph')) return 'analog-watch';
    return 'smartwatch';
  }

  if (c === 'laptops' || n.includes('laptop') || n.includes('macbook') || n.includes('ideapad') || n.includes('vivobook')) return 'laptop';

  if (c === 'keyboards-mice') {
    if (n.includes('combo') || (n.includes('keyboard') && n.includes('mouse'))) return 'keyboard-mouse-combo';
    if (n.includes('mouse') || n.includes('deathadder') || n.includes('mx master') || n.includes('g102') || n.includes('g304')) return 'mouse';
    return 'keyboard';
  }

  if (c === 'power-accessories') {
    if (n.includes('power bank') || n.includes('powerbank') || n.includes('pocket pro')) return 'power-bank';
    if (n.includes('strip') || n.includes('extension') || n.includes('surge')) return 'charging-station';
    return 'wall-charger';
  }

  if (c === 'books') return 'book';

  if (c === 'travel-luggage') {
    if (n.includes('trolley') || n.includes('suitcase') || n.includes('spinner') || n.includes('kamiliant') || n.includes('aristocrat') || n.includes('ivy') || n.includes('thorium')) return 'trolley-luggage';
    if (n.includes('duffle') || n.includes('duffel')) return 'gym-bag';
    return 'backpack';
  }
  if (n.includes('backpack')) return 'backpack';

  if (c === 'gifts') {
    if (n.includes('pendant') || n.includes('necklace') || n.includes('jewel')) return 'necklace';
    if (n.includes('perfume') || n.includes('fragrance') || n.includes('scent')) return 'perfume';
    if (n.includes('wallet')) return 'wallet';
    if (n.includes('analog') || n.includes('raga') || (n.includes('watch') && !n.includes('smartwatch'))) return 'analog-watch';
    if (n.includes('bath') || n.includes('body') || n.includes('spa')) return 'bath-gift-set';
    return 'bath-gift-set';
  }

  return productType || 'unknown';
}

export function resolveClientProductImage(params: {
  productId?: string;
  src?: string;
  name: string;
  category?: string;
  productType?: string;
}): { resolvedSrc: string; resolvedType: string } {
  const resolvedType = inferClientProductType(params.name, params.category, params.productType);
  const rawSrc = (params.src || '').trim();

  // 1. If productId is provided, strictly enforce per-product-ID image resolution
  if (params.productId) {
    const canonicalId = PROMPT_PRODUCT_ID_ALIASES[params.productId] || params.productId;
    const entry = PRODUCT_ID_TO_VERIFIED_URL[canonicalId];
    if (entry) {
      return { resolvedSrc: entry.url, resolvedType: entry.productType };
    }
    return { resolvedSrc: '', resolvedType };
  }

  // 2. If no productId is provided, only accept rawSrc if it is verified for this product type.
  // Never guess or substitute another product's image when rawSrc is empty or unverified.
  const allowedUrls = VISUALLY_VERIFIED_URLS_BY_TYPE[resolvedType] || [];
  if (rawSrc && allowedUrls.includes(rawSrc)) {
    return { resolvedSrc: rawSrc, resolvedType };
  }
  if (rawSrc && resolvedType === 'unknown' && ALL_VERIFIED_URLS.has(rawSrc)) {
    return { resolvedSrc: rawSrc, resolvedType };
  }
  return { resolvedSrc: '', resolvedType };
}

export const ProductImage: React.FC<ProductImageProps> = ({
  productId,
  src,
  alt,
  category,
  productType,
  className = '',
  imageClassName = 'object-cover w-full h-full',
}) => {
  const { resolvedSrc, resolvedType } = resolveClientProductImage({
    productId,
    src,
    name: alt,
    category,
    productType,
  });

  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setHasError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
  }, [resolvedSrc, productId]);

  const getProductTypeIcon = (type?: string, cat?: string) => {
    const t = (type || '').toLowerCase();
    const c = (cat || '').toLowerCase();

    if (t === 'dash-cam') return <Camera className="w-7 h-7 text-zinc-400" />;
    if (t === 'helmet') return <Shield className="w-7 h-7 text-zinc-400" />;
    if (t === 'mouse') return <MousePointer className="w-7 h-7 text-zinc-400" />;
    if (t === 'motorcycle' || t === 'scooter') return <Bike className="w-7 h-7 text-zinc-400" />;
    if (
      t === 'pressure-cooker' ||
      t === 'air-fryer' ||
      t === 'mixer-grinder' ||
      t === 'induction-cooktop' ||
      t === 'cookware-set'
    ) {
      return <Utensils className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'running-shoes' || t === 'training-shoes' || t === 'sneakers' || t === 'boots') {
      return <Footprints className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'hoodie' || t === 'jacket' || t === 't-shirt' || t === 'kurta' || t === 'saree' || t === 'ethnic-set' || t === 'western-wear' || t === 'womens-outerwear') {
      return <Shirt className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'office-chair' || t === 'study-table' || t === 'bookshelf') {
      return <Armchair className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'sunscreen' || t === 'facewash' || t === 'hair-dryer' || t === 'grooming-kit') {
      return <Sparkles className="w-7 h-7 text-zinc-400" />;
    }
    if (
      t === 'yoga-mat' ||
      t === 'dumbbell' ||
      t === 'badminton-racket' ||
      t === 'bicycle' ||
      t === 'football' ||
      t === 'water-bottle' ||
      t === 'gym-bag'
    ) {
      return <Dumbbell className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'earbuds' || t === 'headphones' || t === 'neckband') {
      return <Headphones className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'smartwatch' || t === 'analog-watch') {
      return <Watch className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'smartphone') {
      return <Smartphone className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'laptop') {
      return <Laptop className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'keyboard' || t === 'keyboard-mouse-combo') {
      return <Keyboard className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'power-bank' || t === 'wall-charger' || t === 'charging-station') {
      return <Zap className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'book') {
      return <Book className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'trolley-luggage' || t === 'backpack') {
      return <Briefcase className="w-7 h-7 text-zinc-400" />;
    }
    if (t === 'necklace' || t === 'perfume' || t === 'wallet' || t === 'bath-gift-set') {
      return <Gift className="w-7 h-7 text-zinc-400" />;
    }

    switch (c) {
      case 'headphones':
        return <Headphones className="w-7 h-7 text-zinc-400" />;
      case 'smartphones':
        return <Smartphone className="w-7 h-7 text-zinc-400" />;
      case 'smartwatches':
        return <Watch className="w-7 h-7 text-zinc-400" />;
      case 'laptops':
        return <Laptop className="w-7 h-7 text-zinc-400" />;
      case 'keyboards-mice':
        return <Keyboard className="w-7 h-7 text-zinc-400" />;
      case 'power-accessories':
        return <Zap className="w-7 h-7 text-zinc-400" />;
      case 'fashion':
      case 'kurtis-kurtas':
      case 'sarees':
      case 'ethnic-sets-festive-wear':
      case 'western-wear':
      case 'womens-outerwear':
      case 'womens-ethnic-wear':
        return <Shirt className="w-7 h-7 text-zinc-400" />;
      case 'footwear':
        return <Footprints className="w-7 h-7 text-zinc-400" />;
      case 'furniture':
        return <Armchair className="w-7 h-7 text-zinc-400" />;
      case 'kitchen-appliances':
        return <Utensils className="w-7 h-7 text-zinc-400" />;
      case 'beauty-personal-care':
        return <Sparkles className="w-7 h-7 text-zinc-400" />;
      case 'sports-fitness':
        return <Dumbbell className="w-7 h-7 text-zinc-400" />;
      case 'automotive':
        return <Bike className="w-7 h-7 text-zinc-400" />;
      case 'books':
        return <Book className="w-7 h-7 text-zinc-400" />;
      case 'travel-luggage':
        return <Briefcase className="w-7 h-7 text-zinc-400" />;
      case 'gifts':
        return <Gift className="w-7 h-7 text-zinc-400" />;
      default:
        return <ShoppingBag className="w-7 h-7 text-zinc-400" />;
    }
  };

  const formatProductType = (type?: string, cat?: string): string => {
    if (type && type !== 'unknown') {
      return type
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    if (cat) {
      return cat
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    return 'Product';
  };

  const getPlaceholderSurfaceClass = (cat?: string): string => {
    const c = (cat || '').toLowerCase();
    switch (c) {
      case 'footwear':
      case 'sports-fitness':
        return 'bg-[#DCE7D9]/55';
      case 'smartphones':
      case 'laptops':
      case 'headphones':
      case 'smartwatches':
      case 'keyboards-mice':
      case 'power-accessories':
        return 'bg-[#DCE7EE]/65';
      case 'fashion':
      case 'kurtis-kurtas':
      case 'sarees':
      case 'ethnic-sets-festive-wear':
      case 'western-wear':
      case 'womens-outerwear':
      case 'womens-ethnic-wear':
      case 'beauty-personal-care':
      case 'gifts':
        return 'bg-[#F5E6DF]/70';
      case 'kitchen-appliances':
      case 'furniture':
      case 'books':
        return 'bg-[#F6ECD5]/65';
      default:
        return 'bg-[#EDE8DF]';
    }
  };

  // Studio vehicle side-profile cutouts from AEPL have a pure white studio background
  const isStudioCutout =
    resolvedSrc.includes('imgd.aeplcdn.com') ||
    resolvedSrc.includes('static.ftshp.digital') ||
    resolvedSrc.includes('carnivalbkk.com') ||
    resolvedSrc.includes('i.ebayimg.com') ||
    resolvedSrc.includes('sneakernews.com') ||
    resolvedSrc.includes('akinoncloud.com');

  if (!resolvedSrc || hasError) {
    const typeLabel = formatProductType(resolvedType, category);
    const surfaceBg = getPlaceholderSurfaceClass(category);
    return (
      <div
        data-testid="product-image-placeholder"
        role="img"
        aria-label={`${alt} — ${typeLabel} placeholder`}
        title={alt}
        className={`w-full h-full ${surfaceBg} flex flex-col items-center justify-center p-5 text-center select-none ${className}`}
      >
        <div className="w-12 h-12 rounded-2xl bg-white/90 border border-[#254B3B]/15 flex items-center justify-center mb-2.5 shadow-2xs text-[#254B3B]">
          {getProductTypeIcon(resolvedType, category)}
        </div>
        <span className="text-xs font-semibold text-[#282824] line-clamp-2 leading-snug px-2 max-w-[220px]">
          {alt}
        </span>
        <span className="mt-1.5 px-2.5 py-0.5 rounded-full bg-white/80 border border-[#282824]/10 text-[9px] text-[#254B3B] font-bold uppercase tracking-wider">
          {typeLabel} • SmartCart AI
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full overflow-hidden flex items-center justify-center ${
        isStudioCutout ? 'bg-white' : 'bg-[#F4F1EA]'
      } ${className}`}
    >
      {isLoading && (
        <div className="absolute inset-0 bg-[#F4F1EA] animate-pulse flex items-center justify-center z-0">
          <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
            {getProductTypeIcon(resolvedType, category)}
          </div>
        </div>
      )}
      <img
        key={`${productId || alt}-${resolvedSrc}`}
        ref={imgRef}
        src={resolvedSrc}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        className={`relative z-10 w-full h-full transition-all duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${
          isStudioCutout
            ? 'object-contain p-2.5 group-hover:scale-105'
            : imageClassName
        }`}
      />
    </div>
  );
};
