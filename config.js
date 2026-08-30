window.STUDY_CARDS_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbyeEwdHpvfr5uGIn-HDoGMiTCIudG3vQDes_MuSooqRjGaZ4R49LhgEU-m8p8tl2CLw/exec'
};

(() => {
  const script = document.createElement('script');
  script.src = './nudge.js?v=1';
  document.head.appendChild(script);
})();
