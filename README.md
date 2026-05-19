# 📅 MelCalendar (Agenda Mel)

O **MelCalendar** (conhecido na interface como Agenda Mel) é uma aplicação web de calendário premium desenvolvida especificamente para auxiliar no gerenciamento de guarda compartilhada (co-parenting). 

A ferramenta oferece uma interface intuitiva, moderna e responsiva para gerenciar as escalas de "Com Filhos" e "Sem Filhos", além de permitir a adição de eventos específicos diários, tudo com sincronização em nuvem via Google Apps Script.

---

## ✨ Principais Funcionalidades

- **Escala Recorrente (Regras de Guarda):** Permite configurar regras para dias "Com Filhos" e "Sem Filhos" com repetição semanal ou quinzenal a partir de uma data de início.
- **Sobrescrita de Status Diário (Overrides):** É possível forçar o status de um dia específico (ex: trocar o status do dia para "Com Filhos" fora da regra padrão).
- **Gerenciamento de Eventos:** Adicione, edite ou exclua eventos diários com horários e descrições personalizadas.
- **Exportação de Agenda (.ics):** Exporte a agenda completa ou eventos individuais para importação no Google Calendar, Apple Calendar, Outlook, etc.
- **Filtros e Busca Inteligente:** Encontre eventos através de palavras-chave, filtre por intervalo de datas, status da guarda e veja apenas os dias que possuem eventos marcados.
- **Sincronização na Nuvem:** Integração transparente com um backend em Google Apps Script para persistência de dados e configurações, garantindo que suas informações estejam seguras e sincronizadas (com fallback em LocalStorage).
- **Design Premium e Responsivo:** Desenvolvido com Tailwind CSS, focado na experiência mobile (mobile-first), com botões rápidos como o "Ir para Hoje" e modais intuitivos.

## 💻 Tecnologias Utilizadas

- **Frontend:**
  - HTML5 & CSS3
  - JavaScript Vanilla (ES6+)
  - [Tailwind CSS](https://tailwindcss.com/) via CDN para estilização rápida e responsiva.
  - [Phosphor Icons](https://phosphoricons.com/) para iconografia moderna.
  - [Google Fonts](https://fonts.google.com/) (Plus Jakarta Sans).

- **Backend / Persistência:**
  - **Google Apps Script:** Atua como uma API REST para salvar e buscar o estado do calendário (eventos e configurações) contornando limitações de infraestrutura.

## 🚀 Como Executar o Projeto

Como o projeto utiliza tecnologias web padrão (HTML/JS/CSS puro) sem um processo de build (frameworks como React ou Vue), sua execução é extremamente simples:

1. Clone o repositório para sua máquina:
   ```bash
   git clone https://github.com/seunome/MelCalendar.git
   ```
2. Abra o arquivo `index.html` em seu navegador.
   *(Recomendado utilizar extensões como o Live Server do VS Code para desenvolvimento local).*

### Configurando o Backend (Google Apps Script)

Por padrão, a URL do Apps Script está definida no arquivo `api.js`.
Se desejar hospedar sua própria base de dados:
1. Crie um script no Google Apps Script.
2. Configure as funções `doGet(e)` e `doPost(e)` para manipular JSON com seus dados.
3. Publique como um App Web e copie a URL gerada.
4. Substitua a constante `WEB_APP_URL` no arquivo `api.js` pela sua URL.

## 📖 Como Usar

### Configurar Escala
1. Clique no ícone de configurações (⚙️) no canto superior direito.
2. Adicione uma "Nova Regra de Escala" selecionando o dia da semana, o status (Com/Sem Filhos), a frequência e a data inicial.
3. O calendário irá calcular os próximos meses automaticamente.

### Adicionar um Evento
1. Clique em qualquer dia do calendário (futuro ou presente).
2. O modal do dia se abrirá. Insira um título, horário e descrição.
3. Opcionalmente, selecione "Repetir até" para criar eventos recorrentes.

### Exportar para o Google Calendar
- Para exportar **tudo**: Clique no ícone de download geral no cabeçalho.
- Para exportar **um evento**: Clique em um dia e use o ícone de download ao lado do evento específico.
