let deferredPrompt;
const btnInstalar = document.getElementById('btnInstalar');

window.addEventListener('beforeinstallprompt', (e) => {
  // Impede o prompt automático padrão do navegador
  e.preventDefault();
  // Salva o evento para uso posterior
  deferredPrompt = e;
  // Exibe o botão de instalação customizado na interface
  if (btnInstalar) {
    btnInstalar.style.display = 'inline-flex';
  }
});

if (btnInstalar) {
  btnInstalar.addEventListener('click', (e) => {
    // Esconde o botão após o clique para evitar múltiplos cliques
    btnInstalar.style.display = 'none';
    if (deferredPrompt) {
      // Dispara o prompt de instalação
      deferredPrompt.prompt();
      // Gerencia a escolha do usuário
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('Usuário aceitou a instalação do Mel Calendar.');
        } else {
          console.log('Usuário recusou a instalação do Mel Calendar.');
          // Mostra o botão novamente caso ele tenha cancelado para poder tentar mais tarde
          btnInstalar.style.display = 'inline-flex';
        }
        deferredPrompt = null;
      });
    }
  });
}

// Oculta o botão caso o app seja instalado com sucesso por outros meios
window.addEventListener('appinstalled', (evt) => {
  console.log('Mel Calendar instalado com sucesso!');
  if (btnInstalar) {
    btnInstalar.style.display = 'none';
  }
  deferredPrompt = null;
});
