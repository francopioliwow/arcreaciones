/* Coordenadas en píxeles de la ilustración original (900 × 1125).
 * Las máscaras crean texturas independientes en memoria. Los bordes comparten
 * vértices de la malla para que el cuello y los codos no se separen al rotar.
 * Cambiar estos datos permite ajustar el personaje sin tocar el motor.
 */
window.ARIANA_RIG = {
  source: 'assets/ariana/source.webp',
  width: 900, height: 1125,
  viewport: { width: 1000, height: 1180, x: 45, y: 25 },
  meshStep: 18,
  bones: {
    waist: [450, 1050], neck: [355, 472],
    shoulder: [606, 531], elbow: [711, 943], wrist: [728, 759]
  },
  limits: { head: 4.2, torso: 0.55, shoulder: 1.6, elbow: 4.5, wrist: 6.5, pupilX: 4.2, pupilY: 2.6 },
  // Primero se extraen las piezas delanteras; el resto forma el torso.
  layers: [
    { id: 'hand', name: 'Mano y muñeca', path: 'M674 782 Q679 721 690 693 L738 660 L822 609 L900 585 L900 801 L780 853 Q718 856 674 828 Z' },
    { id: 'forearm', name: 'Antebrazo', path: 'M675 777 L803 787 L857 915 L779 1033 L668 1025 L618 936 Q640 864 675 777 Z' },
    { id: 'upper-arm', name: 'Brazo', path: 'M568 449 Q662 439 705 566 L752 784 L684 960 L627 927 Q636 774 593 674 Q549 593 550 510 Z' },
    { id: 'hair-front-left', name: 'Cabello delantero izquierdo', path: 'M224 285 Q258 286 268 318 Q240 431 253 511 Q287 635 175 735 L184 648 Q200 583 199 552 Q127 591 60 565 L58 531 Q165 443 224 285 Z' },
    { id: 'hair-front-right', name: 'Cabello delantero derecho', path: 'M553 295 L591 328 L613 446 Q531 488 548 556 L514 664 Q465 651 442 604 Q419 531 474 430 Z' },
    { id: 'hair-back', name: 'Cabello trasero', path: 'M0 0 H650 V451 L570 463 L547 263 L508 117 Q341 55 249 256 L188 450 L106 540 L0 530 Z' },
    { id: 'head', name: 'Cabeza y cuello', path: 'M0 0 H650 V441 L506 476 L455 532 L280 525 L221 471 L0 461 Z' }
  ],
  eyes: [
    { name: 'left', box: [337, 188, 83, 53], center: [382, 214], radius: 13,
      opening: 'M357 206 C374 200 399 211 405 226 C387 227 368 218 357 206 Z',
      angle: 24 },
    { name: 'right', box: [458, 240, 74, 47], center: [489, 262], radius: 12,
      opening: 'M470 256 C483 249 503 258 511 275 C494 273 480 264 470 256 Z',
      angle: 25 }
  ]
};
