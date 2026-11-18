const steamEvents = 'https://partner.steamgames.com/doc/marketing/upcoming_events';
const events = [
    {title:'Black Friday de PlayStation Store',start:'2026-11-16',end:'2026-11-30',platforms:['ps'],kind:'sale',
        note:'Ofertas en juegos digitales de PS4 y PS5. Algunos títulos salen antes del cierre.',
        url:'https://blog.playstation.com/2026/11/03/playstations-black-friday-deals-2026'},
    {title:'Black Friday de Xbox',start:'2026-11-19',end:'2026-12-02',platforms:['xbox','pc'],kind:'sale',
        note:'Ofertas en juegos seleccionados para Xbox y PC. El inicio anunciado es la noche del 19, hora del Pacífico.',
        url:'https://news.xbox.com/en-us/2026/11/16/xbox-black-friday-sale-2026/'},
    {title:'Black Friday en Steam',start:'2026-11-26',end:'2026-11-30',platforms:['pc'],kind:'sale',
        note:'Steam destacará los descuentos que publiquen los estudios en la página de descuentos y eventos.',
        url:steamEvents+'#blackfriday'},
    {title:'Ofertas de invierno de Steam',start:'2026-12-17',end:'2027-01-04',platforms:['pc'],kind:'sale',
        note:'La venta de temporada de Steam abre y cierra a las 10:00 a. m., hora del Pacífico.',
        url:steamEvents + '/2026_winter_sale'},
    {title:'Ofertas de primavera de Steam',start:'2027-03-18',end:'2027-03-25',platforms:['pc'],kind:'sale',url:steamEvents},
    {title:'Ofertas de verano de Steam',start:'2027-06-24',end:'2027-07-08',platforms:['pc'],kind:'sale',url:steamEvents},
    {title:'El profesor Layton y el Nuevo Mundo a vapor',start:'2026-12-09',platforms:['pc'],kind:'release',
        note:'El profesor Layton y Luke vuelven con una aventura de puzles y misterio para PC.',
        image:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3384600/cd0487c6f04e410153dfece870889f99ea7f3e8e/capsule_616x353.jpg',
        url:'https://store.steampowered.com/app/3384600/Professor_Layton_and_the_New_World_of_Steam/'},
    {title:'El profesor Layton y el Nuevo Mundo a vapor',start:'2026-12-10',platforms:['switch'],kind:'release',
        note:'La aventura de puzles llega a Nintendo Switch y Nintendo Switch 2.',
        image:'https://www.nintendo.com/eu/media/images/10_share_images/games_15/nintendo_switch_4/2x1_NSwitch_ProfessorLaytonAndTheNewWorldOfSteam_esES_image1280w.jpg',
        url:'https://www.nintendo.com/es-es/Juegos/Juegos-de-Nintendo-Switch/El-profesor-Layton-y-el-Nuevo-Mundo-a-vapor-2339757.html'},
    {title:'Dispatch',start:'2026-12-09',platforms:['android','pc'],kind:'release',
        note:'La aventura llega a Android y Google Play Juegos para PC, con cuatro episodios iniciales gratis.',
        image:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2592160/header.jpg',
        url:'https://adhocstudio.com/news/dispatch-one-year-anniversary'},
    {title:'Titan Quest II',start:'2027-01-19',platforms:['pc','xbox','ps'],kind:'release',
        note:'Lanzamiento de la versión completa en PC, Xbox Series X|S y PS5.',
        image:'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1154030/header.jpg',
        url:'https://thqnordic.com/news/a-special-delivery-from-hermes-titan-quest-ii-launches-january-2027-on-pc-and-consoles'},
    {title:'Fable',start:'2027-02-23',platforms:['pc','xbox','ps'],kind:'release',
        note:'Regreso a Albion en PC, Xbox Series X|S y PS5. Xbox anuncia su llegada a Game Pass desde el lanzamiento.',
        image:'https://cms-assets.xboxservices.com/assets/bb/16/bb1619da-8379-477a-9a49-ff3b6636ba8c.jpg?n=993888452001-04316_Sharing_200x200.jpg',
        url:'https://www.xbox.com/en-us/games/fable'},
    ...[
        ['Festival de RPG de combate automático','2026-11-16','2026-11-23','RPG con combates automáticos.'],
        ['Festival de compañeros de escritorio','2027-01-14','2027-01-18','Juegos que puedes tener abiertos mientras usas el escritorio.'],
        ['Festival de gestión de tiendas','2027-01-25','2027-02-01','Juegos sobre administrar tu propio negocio.'],
        ['Festival de ovejas','2027-02-04','2027-02-08','Juegos con ovejas, cabras y otros caprinos.'],
        ['Festival de cooperativo local','2027-02-08','2027-02-15','Juegos para compartir la misma pantalla o dispositivo.'],
        ['Steam Next Fest','2027-02-22','2027-03-01','Demos de juegos en desarrollo.']
    ].map(([title,start,end,note])=>({title,start,end,note,platforms:['pc'],kind:'festival',url:steamEvents}))
];

const verified = '2026-11-18';
const subscriptions = [
    {platform:'pc', name:'PC Game Pass', url:'https://www.xbox.com/es-MX/games/store/game-pass/CFQ7TTC0KGQ8', plans:[
        ['PC Game Pass','Catálogo para PC, EA Play y lanzamientos seleccionados desde el primer día.',[[209,'mes']]]
    ]},
    {platform:'xbox', name:'Xbox Game Pass', url:'https://www.xbox.com/es-MX/xbox-game-pass', plans:[
        ['Essential','Multijugador en consola y catálogo inicial.',[[169,'mes']]],
        ['Premium','Catálogo ampliado y acceso prioritario al juego en la nube.',[[219,'mes']]],
        ['Ultimate','Catálogo más amplio, lanzamientos seleccionados el primer día, EA Play y Ubisoft+ Classics.',[[339,'mes']]]
    ]},
    {platform:'ps', name:'PlayStation Plus', url:'https://www.playstation.com/es-mx/ps-plus/whats-new/', plans:[
        ['Essential','Juegos mensuales, multijugador y descuentos.',[[149,'mes'],[399,'3 meses'],[1120.18,'año']]],
        ['Extra','Añade el catálogo de juegos de PS4 y PS5.',[[229,'mes'],[659,'3 meses'],[1861.34,'año']]],
        ['Deluxe','Añade clásicos y pruebas de juegos.',[[279,'mes'],[759,'3 meses'],[2154.35,'año']]]
    ]},
    {platform:'switch', name:'Nintendo Switch Online', url:'https://www.nintendo.com/es-mx/online/compare-memberships/', plans:[
        ['Individual','Juego en línea, copias compatibles en la nube y Nintendo Classics.',[[409,'año']]],
        ['Individual + Expansión','Añade bibliotecas clásicas y contenido descargable seleccionado.',[[1029,'año']]],
        ['Familiar','Beneficios del plan base para hasta ocho cuentas.',[[719,'año']]],
        ['Familiar + Expansión','Beneficios del paquete de expansión para hasta ocho cuentas.',[[1649,'año']]]
    ]},
    {platform:'android', name:'Google Play Pass', url:'https://play.google.com/store/pass?hl=es&gl=MX', plans:[
        ['Play Pass','Selección de juegos y apps en Android. Consulta las opciones y el precio de México desde la app de Play Store.',[]]
    ]}
];

module.exports = {events,subscriptions,verified};
