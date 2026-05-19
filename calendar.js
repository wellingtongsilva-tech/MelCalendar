/**
 * Main calendar logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & State ---
    const YEAR = 2026;
    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    
    let state = {
        events: [],
        config: {
            appTitle: 'Agenda Mel',
            fixedRules: [], // Array of { dayOfWeek, type, frequency, start, desc }
            dayOverrides: {} // Overrides: 'YYYY-MM-DD': 'Com Filhos'|'Sem Filhos'
        },
        search: {
            query: '',
            start: '',
            end: '',
            status: '',
            hasEventsOnly: false,
            showPastNormal: false
        },
        isReady: false,
        selectedDate: null
    };

    // --- DOM Elements ---
    const rootEl = document.getElementById('calendar-root');
    const searchInput = document.getElementById('search-input');
    const filterStart = document.getElementById('filter-date-start');
    const filterEnd = document.getElementById('filter-date-end');
    const filterStatus = document.getElementById('filter-status');
    const btnToggleFilters = document.getElementById('btn-toggle-filters');
    const filtersPanel = document.getElementById('search-filters-panel');
    const btnToday = document.getElementById('btn-today');
    const btnConfig = document.getElementById('btn-config');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Modals
    const dayModal = document.getElementById('day-modal');
    const settingsModal = document.getElementById('settings-modal');

    // Title
    const appTitleDisplay = document.getElementById('app-title-display');
    const btnEditTitle = document.getElementById('btn-edit-title');

    // --- Core Logic ---

    // Função central de salvamento na nuvem
    async function saveStateToCloud() {
        renderCalendar(); // Renderiza local primeiro para sensação de tempo real
        try {
            await window.api.syncData({
                events: state.events,
                config: state.config
            });
            // Backup no local storage por precaução
            localStorage.setItem('melConfigRules2', JSON.stringify(state.config.fixedRules));
        } catch(e) {
            console.error("Falha ao sincronizar com a nuvem", e);
        }
    }

    function generateCalendarData() {
        const weeks = [];
        let currentWeek = [];
        
        const firstDayOfYear = new Date(YEAR, 0, 1);
        const firstDayOfWeek = firstDayOfYear.getDay(); 
        let offsetToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        
        let currentDate = new Date(YEAR, 0, 1 - offsetToMonday);
        const todayStr = getTodayStr();
        
        while (currentDate.getFullYear() <= YEAR || currentWeek.length > 0) {
            if (currentDate.getFullYear() > YEAR && currentWeek.length === 0) break;

            const dateStr = formatDateStr(currentDate);
            const dayOfWeek = currentDate.getDay(); 

            const dayInfo = {
                date: new Date(currentDate),
                dateStr: dateStr,
                isCurrentYear: currentDate.getFullYear() === YEAR,
                isPast: dateStr < todayStr,
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
                dayType: calculateDayType(currentDate, dayOfWeek)
            };
            
            currentWeek.push(dayInfo);

            if (currentWeek.length === 7) {
                weeks.push([...currentWeek]);
                currentWeek = [];
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return weeks;
    }

    function calculateDayType(dateObj, dayOfWeek) {
        let matchedType = null;
        const dateStr = formatDateStr(dateObj);
        
        if (state.config.dayOverrides && state.config.dayOverrides[dateStr]) {
            return state.config.dayOverrides[dateStr];
        }
        
        const rulesForDay = state.config.fixedRules.filter(r => r.dayOfWeek == dayOfWeek);
        
        for (const rule of rulesForDay) {
            if (dateStr < rule.start) continue; 
            
            if (rule.frequency === 'semanal') {
                matchedType = rule.type;
                // Last matched rule wins or first? Let's say last matched overrides.
            } else if (rule.frequency === 'quinzenal') {
                const ruleStartDate = new Date(rule.start + 'T00:00:00');
                const d = new Date(dateObj);
                d.setHours(0,0,0,0);
                ruleStartDate.setHours(0,0,0,0);
                
                const diffMs = d.getTime() - ruleStartDate.getTime();
                const diffWeeks = Math.round(diffMs / MS_PER_WEEK);
                
                if (diffWeeks % 2 === 0) {
                    matchedType = rule.type;
                }
            }
        }
        
        return matchedType;
    }

    function formatDateStr(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function getTodayStr() {
        const today = new Date();
        const demoToday = today.getFullYear() === 2026 ? today : new Date(2026, 4, 15);
        return formatDateStr(demoToday);
    }

    // --- Rendering Main Calendar ---

    function renderCalendar() {
        rootEl.innerHTML = '';
        if (!state.isReady) return;

        const weeks = generateCalendarData();
        
        // Compute stats
        const monthStats = Array.from({length: 12}, () => ({ comFilhos: 0, semFilhos: 0, indefinido: 0 }));
        const yearStats = { comFilhos: 0, semFilhos: 0, indefinido: 0 };
        
        weeks.forEach(week => {
            week.forEach(day => {
                if (day.date.getFullYear() === YEAR) {
                    const m = day.date.getMonth();
                    if (day.dayType === 'Com Filhos') { monthStats[m].comFilhos++; yearStats.comFilhos++; }
                    else if (day.dayType === 'Sem Filhos') { monthStats[m].semFilhos++; yearStats.semFilhos++; }
                    else { monthStats[m].indefinido++; yearStats.indefinido++; }
                }
            });
        });

        let currentMonth = -1;
        let currentMonthContainer = null;
        let currentMonthContent = null;
        let currentMonthCalWrapper = null;
        const currentRealMonth = new Date().getMonth();
        const currentRealYear = new Date().getFullYear();
        const todayStr = getTodayStr();
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        // Guardar as instâncias de gráficos para poder alterar o tipo depois
        const chartInstances = {};

        function renderChart(canvasId, stats, type = 'pie') {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return null;
            
            if (chartInstances[canvasId]) {
                chartInstances[canvasId].destroy();
            }
            
            if (typeof ChartDataLabels !== 'undefined') {
                Chart.register(ChartDataLabels);
            }
            
            const rawLabels = ['Com Filhos', 'Sem Filhos', 'Indefinido'];
            const rawData = [stats.comFilhos, stats.semFilhos, stats.indefinido];
            const rawColors = ['#10b981', '#f97316', '#cbd5e1'];
            
            const labels = [];
            const dataArr = [];
            const colors = [];
            
            for (let i = 0; i < rawData.length; i++) {
                if (rawData[i] > 0 || rawLabels[i] !== 'Indefinido') {
                    labels.push(rawLabels[i]);
                    dataArr.push(rawData[i]);
                    colors.push(rawColors[i]);
                }
            }
            
            const data = {
                labels: labels,
                datasets: [{
                    data: dataArr,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            };

            const config = {
                type: type,
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { family: 'Plus Jakarta Sans', weight: 'bold' } } },
                        datalabels: {
                            color: '#ffffff',
                            textAlign: 'center',
                            font: {
                                weight: 'bold',
                                family: 'Plus Jakarta Sans',
                                size: 14
                            },
                            formatter: (value, context) => {
                                if (value === 0) return null;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                if (total === 0) return null;
                                const percentage = Math.round((value / total) * 100) + '%';
                                return `${value}d\n${percentage}`;
                            }
                        }
                    }
                }
            };

            const chart = new Chart(ctx, config);
            chartInstances[canvasId] = chart;
            return chart;
        }

        weeks.forEach((week, weekIndex) => {
            const thursday = week[3].date;
            if (thursday.getFullYear() === YEAR && thursday.getMonth() !== currentMonth) {
                currentMonth = thursday.getMonth();
                
                currentMonthContainer = document.createElement('div');
                currentMonthContainer.className = 'w-full mb-4';
                
                const isPastMonth = (YEAR < currentRealYear) || (YEAR === currentRealYear && currentMonth < currentRealMonth);
                const isOpen = !isPastMonth;
                const defaultView = isPastMonth ? 'chart' : 'calendar';
                
                const sep = document.createElement('div');
                sep.className = 'month-separator transition-colors group scroll-mt-24';
                
                sep.innerHTML = `
                    <div class="flex items-center gap-3 bg-white border border-slate-100 shadow-sm rounded-full pl-5 pr-2 py-1.5 hover:border-indigo-200 transition-colors z-10 w-full justify-between sm:w-auto sm:justify-start">
                        <div class="flex items-center gap-2 cursor-pointer font-bold text-slate-700 outline-none text-sm sm:text-base flex-1 accordion-toggle-area">
                            ${monthNames[currentMonth]} ${YEAR}
                            <i class="ph ph-caret-down text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}"></i>
                        </div>
                        
                        <div class="flex items-center gap-1 bg-slate-50 p-1 rounded-full border border-slate-100">
                            <button type="button" class="btn-view-cal flex items-center justify-center w-7 h-7 rounded-full transition-all ${defaultView === 'calendar' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}" title="Ver Calendário">
                                <i class="ph ph-calendar-blank"></i>
                            </button>
                            <button type="button" class="btn-view-chart flex items-center justify-center w-7 h-7 rounded-full transition-all ${defaultView === 'chart' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}" title="Ver Gráfico">
                                <i class="ph ph-chart-pie-slice"></i>
                            </button>
                        </div>
                    </div>
                `;
                
                currentMonthContent = document.createElement('div');
                currentMonthContent.className = `month-content flex flex-col ${isOpen ? 'mt-4' : 'hidden'}`;
                
                const calWrapper = document.createElement('div');
                calWrapper.className = `month-calendar-view ${defaultView === 'calendar' ? '' : 'hidden'}`;
                currentMonthCalWrapper = calWrapper;
                
                const chartWrapper = document.createElement('div');
                chartWrapper.className = `month-chart-view ${defaultView === 'chart' ? '' : 'hidden'} bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative`;
                const canvasId = `chart-month-${currentMonth}`;
                chartWrapper.innerHTML = `
                    <div class="flex justify-end mb-4">
                        <select class="chart-type-select text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-md py-1 px-2 outline-none cursor-pointer">
                            <option value="pie">Gráfico de Pizza</option>
                            <option value="doughnut">Gráfico de Rosca</option>
                            <option value="bar">Gráfico de Barras</option>
                        </select>
                    </div>
                    <div class="relative h-64 w-full flex items-center justify-center">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                `;

                currentMonthContent.appendChild(calWrapper);
                currentMonthContent.appendChild(chartWrapper);
                
                const contentDiv = currentMonthContent;
                const toggleArea = sep.querySelector('.accordion-toggle-area');
                const btnCal = sep.querySelector('.btn-view-cal');
                const btnChart = sep.querySelector('.btn-view-chart');
                const chartSelect = chartWrapper.querySelector('.chart-type-select');
                
                const mStats = monthStats[currentMonth];
                
                toggleArea.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const icon = toggleArea.querySelector('i');
                    if (contentDiv.classList.contains('hidden')) {
                        contentDiv.classList.remove('hidden');
                        contentDiv.classList.add('mt-4');
                        icon.classList.add('rotate-180');
                        setTimeout(() => toggleArea.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                        // render chart if it's the active view and not rendered yet
                        if (!calWrapper.classList.contains('hidden') === false) {
                             renderChart(canvasId, mStats, chartSelect.value);
                        }
                    } else {
                        contentDiv.classList.add('hidden');
                        contentDiv.classList.remove('mt-4');
                        icon.classList.remove('rotate-180');
                    }
                };

                const setView = (view) => {
                    if (view === 'calendar') {
                        calWrapper.classList.remove('hidden');
                        chartWrapper.classList.add('hidden');
                        btnCal.className = 'btn-view-cal flex items-center justify-center w-7 h-7 rounded-full transition-all bg-white shadow-sm text-indigo-600';
                        btnChart.className = 'btn-view-chart flex items-center justify-center w-7 h-7 rounded-full transition-all text-slate-400 hover:text-slate-600';
                    } else {
                        calWrapper.classList.add('hidden');
                        chartWrapper.classList.remove('hidden');
                        btnChart.className = 'btn-view-chart flex items-center justify-center w-7 h-7 rounded-full transition-all bg-white shadow-sm text-indigo-600';
                        btnCal.className = 'btn-view-cal flex items-center justify-center w-7 h-7 rounded-full transition-all text-slate-400 hover:text-slate-600';
                        // Render chart when switching to chart view
                        renderChart(canvasId, mStats, chartSelect.value);
                    }
                };

                btnCal.onclick = (e) => { e.stopPropagation(); setView('calendar'); };
                btnChart.onclick = (e) => { e.stopPropagation(); setView('chart'); };
                
                chartSelect.onchange = (e) => {
                    renderChart(canvasId, mStats, e.target.value);
                };

                currentMonthContainer.appendChild(sep);
                currentMonthContainer.appendChild(currentMonthContent);
                rootEl.appendChild(currentMonthContainer);
                
                // If chart is the default view and it's open, render immediately (won't happen because past months are closed by default, but just in case)
                if (isOpen && defaultView === 'chart') {
                    // Need to wait until it's actually in DOM
                    setTimeout(() => renderChart(canvasId, mStats, chartSelect.value), 0);
                }
            }

            const weekRow = document.createElement('div');
            weekRow.className = 'grid grid-cols-7 calendar-grid animate-fade-in mb-3';
            weekRow.style.animationDelay = `${(weekIndex % 10) * 20}ms`;

            week.forEach(day => {
                const isToday = day.dateStr === todayStr;
                const isDimmed = !day.isCurrentYear;
                
                // Filter events
                let dayEvents = state.events.filter(e => e.date === day.dateStr);
                
                let filteredEvents = dayEvents.filter(e => {
                    let match = true;
                    if (state.search.query) {
                        const q = state.search.query.toLowerCase();
                        match = e.title.toLowerCase().includes(q) || (e.description && e.description.toLowerCase().includes(q));
                    }
                    if (match && state.search.start) {
                        match = e.date >= state.search.start;
                    }
                    if (match && state.search.end) {
                        match = e.date <= state.search.end;
                    }
                    return match;
                });

                // Status Filter logic
                let dayHiddenByStatus = false;
                if (state.search.status && day.dayType !== state.search.status) {
                    dayHiddenByStatus = true;
                }

                // Has Events Filter logic
                let dayHiddenByHasEvents = false;
                if (state.search.hasEventsOnly && dayEvents.length === 0) {
                    dayHiddenByHasEvents = true;
                }

                const dimDueToSearch = ((state.search.query || state.search.start || state.search.end) && filteredEvents.length === 0) || dayHiddenByStatus || dayHiddenByHasEvents;

                const dayCell = document.createElement('div');
                
                let bgColorClass = 'bg-white';
                if (day.isPast && !state.search.showPastNormal) {
                    bgColorClass = 'is-past';
                } else if (day.dayType === 'Com Filhos') {
                    bgColorClass = 'bg-com-filhos';
                } else if (day.dayType === 'Sem Filhos') {
                    bgColorClass = 'bg-sem-filhos';
                }

                dayCell.className = `calendar-day relative p-1.5 sm:p-3 flex flex-col justify-between
                                     ${bgColorClass}
                                     ${isDimmed ? 'opacity-40 grayscale text-slate-400' : ''} 
                                     ${isToday ? 'day-today' : ''}
                                     ${dimDueToSearch ? 'opacity-20 grayscale' : 'opacity-100'}`;
                
                dayCell.id = `day-${day.dateStr}`;
                dayCell.onclick = () => openDayModal(day);

                let dateNumHtml = `<div class="date-number text-xs sm:text-sm font-bold ${isDimmed ? 'text-slate-400' : 'text-slate-700'}">${day.date.getDate()}</div>`;
                if (day.date.getDate() === 1 && !isDimmed) {
                    dateNumHtml = `<div class="date-number text-xs sm:text-sm font-bold text-slate-700">${day.date.getDate()} ${monthNames[day.date.getMonth()].substr(0,3)}</div>`;
                }

                const headerHtml = `<div>${dateNumHtml}</div>`;

                let badgeHtml = '';
                if (filteredEvents.length > 0) {
                    badgeHtml = `<div class="absolute bottom-2 right-2 event-badge rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] sm:text-xs font-bold">${filteredEvents.length}</div>`;
                }

                dayCell.innerHTML = headerHtml + badgeHtml;
                weekRow.appendChild(dayCell);
            });

            currentMonthCalWrapper.appendChild(weekRow);
        });

        // Add Yearly Plan accordion
        const yearContainer = document.createElement('div');
        yearContainer.className = 'w-full mt-8 mb-4';
        
        const yearSep = document.createElement('div');
        yearSep.className = 'month-separator transition-colors group';
        
        yearSep.innerHTML = `
            <div class="flex items-center gap-3 bg-white border border-slate-100 shadow-sm rounded-full pl-5 pr-2 py-1.5 hover:border-indigo-200 transition-colors z-10 w-full justify-between sm:w-auto sm:justify-start">
                <div class="flex items-center gap-2 cursor-pointer font-bold text-slate-700 outline-none text-sm sm:text-base flex-1 accordion-toggle-area">
                    <i class="ph-fill ph-chart-polar text-indigo-500 text-lg"></i> Planejamento Anual ${YEAR}
                    <i class="ph ph-caret-down text-slate-400 transition-transform duration-300"></i>
                </div>
            </div>
        `;
        
        const yearContent = document.createElement('div');
        yearContent.className = 'month-content flex flex-col hidden';
        
        const yearChartWrapper = document.createElement('div');
        yearChartWrapper.className = 'bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative mt-4';
        const yearCanvasId = 'chart-year';
        yearChartWrapper.innerHTML = `
            <div class="flex justify-end mb-4">
                <select class="chart-type-select text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-md py-1 px-2 outline-none cursor-pointer">
                    <option value="pie">Gráfico de Pizza</option>
                    <option value="doughnut">Gráfico de Rosca</option>
                    <option value="bar">Gráfico de Barras</option>
                </select>
            </div>
            <div class="relative h-72 w-full flex items-center justify-center">
                <canvas id="${yearCanvasId}"></canvas>
            </div>
        `;
        
        yearContent.appendChild(yearChartWrapper);
        
        const yToggleArea = yearSep.querySelector('.accordion-toggle-area');
        const yChartSelect = yearChartWrapper.querySelector('.chart-type-select');
        
        yToggleArea.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const icon = yToggleArea.querySelector('.ph-caret-down');
            if (yearContent.classList.contains('hidden')) {
                yearContent.classList.remove('hidden');
                icon.classList.add('rotate-180');
                setTimeout(() => yToggleArea.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                setTimeout(() => renderChart(yearCanvasId, yearStats, yChartSelect.value), 10);
            } else {
                yearContent.classList.add('hidden');
                icon.classList.remove('rotate-180');
            }
        };

        yChartSelect.onchange = (e) => {
            renderChart(yearCanvasId, yearStats, e.target.value);
        };

        yearContainer.appendChild(yearSep);
        yearContainer.appendChild(yearContent);
        rootEl.appendChild(yearContainer);
    }

    // --- Day Modal Logic ---

    function openDayModal(day) {
        state.selectedDate = day.dateStr;
        
        const dObj = new Date(day.date.getTime() + Math.abs(day.date.getTimezoneOffset()*60000));
        document.getElementById('day-modal-title').textContent = dObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
        document.getElementById('day-event-date').value = day.dateStr;
        
        const badge = document.getElementById('day-modal-status-badge');
        badge.textContent = day.dayType || 'Indefinido';
        if (day.dayType === 'Com Filhos') {
            badge.className = 'text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700';
        } else if (day.dayType === 'Sem Filhos') {
            badge.className = 'text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-orange-100 text-orange-700';
        } else {
            badge.className = 'text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-100 text-slate-500';
        }

        const selectOverride = document.getElementById('day-override-select');
        selectOverride.value = (state.config.dayOverrides && state.config.dayOverrides[day.dateStr]) ? state.config.dayOverrides[day.dateStr] : '';
        
        const newSelect = selectOverride.cloneNode(true);
        selectOverride.parentNode.replaceChild(newSelect, selectOverride);
        newSelect.addEventListener('change', (e) => {
            if (!state.config.dayOverrides) state.config.dayOverrides = {};
            if (e.target.value === '') {
                delete state.config.dayOverrides[day.dateStr];
            } else {
                state.config.dayOverrides[day.dateStr] = e.target.value;
            }
            saveStateToCloud();
            
            const newType = calculateDayType(day.date, day.date.getDay());
            day.dayType = newType;
            openDayModal(day);
        });

        if (day.isPast) {
            document.getElementById('add-event-section').classList.add('hidden');
        } else {
            document.getElementById('add-event-section').classList.remove('hidden');
            document.getElementById('day-add-event-form').reset();
        }

        renderDayEventsList();
        dayModal.classList.remove('hidden');
    }

    function renderDayEventsList() {
        const container = document.getElementById('day-events-list');
        const evts = state.events.filter(e => e.date === state.selectedDate);
        
        if (evts.length === 0) {
            container.innerHTML = `<p class="text-slate-400 text-sm font-medium text-center py-6">Nenhum evento para esta data.</p>`;
            return;
        }

        container.innerHTML = evts.map(evt => `
            <div class="bg-white border border-slate-100 shadow-sm p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-start gap-3 group hover:border-indigo-200 transition-colors">
                <div class="flex-1">
                    <h5 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                        ${evt.title}
                        ${evt.time ? `<span class="text-[10px] font-bold bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded">${evt.time}</span>` : ''}
                    </h5>
                    ${evt.description ? `<p class="text-xs font-medium text-slate-500 mt-1.5 leading-relaxed">${evt.description}</p>` : ''}
                </div>
                <div class="flex items-center gap-1 opacity-100 sm:opacity-50 group-hover:opacity-100 transition-opacity self-end sm:self-auto">
                    <button onclick="window.calendar.editEvent(${evt.id})" class="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg border border-transparent transition-all" title="Editar evento">
                        <i class="ph ph-pencil-simple text-lg"></i>
                    </button>
                    <button onclick="window.calendar.deleteEvent(${evt.id})" class="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg border border-transparent transition-all" title="Excluir evento">
                        <i class="ph ph-trash text-lg"></i>
                    </button>
                    <button onclick="window.calendar.exportEvent(${evt.id})" class="text-indigo-500 hover:text-white hover:bg-indigo-500 p-2 rounded-lg border border-indigo-100 transition-all" title="Exportar para agenda">
                        <i class="ph ph-download-simple text-lg"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    function resetEventForm() {
        document.getElementById('day-add-event-form').reset();
        document.getElementById('day-event-id').value = '';
        document.getElementById('btn-save-day-event').textContent = 'Salvar Evento';
        document.getElementById('btn-cancel-edit-event').classList.add('hidden');
        document.getElementById('btn-save-day-event').classList.remove('w-2/3');
        document.getElementById('btn-save-day-event').classList.add('w-full');
        document.getElementById('day-event-end-container').classList.remove('hidden');
        
        const formContainer = document.getElementById('add-event-form-container');
        const iconToggle = document.getElementById('icon-toggle-add-event');
        if (formContainer && !formContainer.classList.contains('hidden')) {
            formContainer.classList.add('hidden');
            if (iconToggle) iconToggle.classList.remove('rotate-180');
        }
    }

    const btnToggleAddEvent = document.getElementById('btn-toggle-add-event');
    if (btnToggleAddEvent) {
        btnToggleAddEvent.onclick = (e) => {
            e.preventDefault();
            const formContainer = document.getElementById('add-event-form-container');
            const iconToggle = document.getElementById('icon-toggle-add-event');
            if (formContainer.classList.contains('hidden')) {
                formContainer.classList.remove('hidden');
                if (iconToggle) iconToggle.classList.add('rotate-180');
                
                // Em dispositivos móveis, garantir que o formulário apareça na tela
                setTimeout(() => {
                    formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 100);
            } else {
                formContainer.classList.add('hidden');
                if (iconToggle) iconToggle.classList.remove('rotate-180');
            }
        };
    }

    const btnCancelEdit = document.getElementById('btn-cancel-edit-event');
    if (btnCancelEdit) {
        btnCancelEdit.addEventListener('click', resetEventForm);
    }

    // Modal Events
    document.getElementById('btn-close-day-modal').onclick = () => {
        dayModal.classList.add('hidden');
        resetEventForm();
    };
    document.getElementById('day-modal-overlay').onclick = () => {
        dayModal.classList.add('hidden');
        resetEventForm();
    };

    document.getElementById('day-add-event-form').onsubmit = (e) => {
        e.preventDefault();
        const eventId = document.getElementById('day-event-id').value;
        const start = document.getElementById('day-event-date').value;
        const title = document.getElementById('day-event-title').value.trim();
        const desc = document.getElementById('day-event-desc').value.trim();
        const time = document.getElementById('day-event-time').value;
        const end = document.getElementById('day-event-end').value;

        if (eventId) {
            // Edição
            const idx = state.events.findIndex(ev => ev.id === parseInt(eventId));
            if (idx !== -1) {
                state.events[idx] = {
                    ...state.events[idx],
                    title: title,
                    description: desc,
                    time: time
                };
            }
        } else {
            // Criação
            const startDate = new Date(start + 'T00:00:00');
            const endDate = end ? new Date(end + 'T00:00:00') : new Date(startDate);
            
            if (endDate < startDate) {
                alert('A Data Fim deve ser maior ou igual à Data Início.');
                return;
            }

            let current = new Date(startDate);
            let maxId = state.events.length > 0 ? Math.max(...state.events.map(ev => ev.id)) : 0;

            while (current <= endDate) {
                state.events.push({
                    id: ++maxId,
                    date: formatDateStr(current),
                    title: title,
                    description: desc,
                    time: time
                });
                current.setDate(current.getDate() + 1);
            }
        }

        renderDayEventsList();
        saveStateToCloud();
        resetEventForm();
    };

    // --- Settings Modal Logic ---
    
    function renderRulesList() {
        const container = document.getElementById('rules-list');
        if (state.config.fixedRules.length === 0) {
            container.innerHTML = `<p class="text-slate-400 text-sm font-medium text-center py-4">Nenhuma regra de escala definida.</p>`;
            return;
        }

        const daysMap = {0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado'};
        container.innerHTML = state.config.fixedRules.map((r, idx) => `
            <div class="flex items-center justify-between bg-white p-4 border border-slate-100 rounded-xl shadow-sm hover:border-indigo-100 transition-colors">
                <div>
                    <div class="font-bold text-sm text-slate-800">${daysMap[r.dayOfWeek]} <span class="text-xs text-slate-400 font-medium ml-1">(${r.frequency})</span></div>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${r.type === 'Com Filhos' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}">${r.type}</span>
                        <span class="text-xs font-semibold text-slate-500">Início: ${r.start.split('-').reverse().join('/')}</span>
                    </div>
                    ${r.desc ? `<div class="text-xs font-medium text-slate-500 mt-2">${r.desc}</div>` : ''}
                </div>
                <button onclick="window.calendar.removeRule(${idx})" class="text-red-400 hover:text-white hover:bg-red-500 p-2 rounded-lg transition-colors border border-transparent hover:border-red-600">
                    <i class="ph ph-trash text-lg"></i>
                </button>
            </div>
        `).join('');
    }

    btnConfig.onclick = () => {
        // Set default start date to today in the form
        document.getElementById('rule-start').value = getTodayStr();
        renderRulesList();
        settingsModal.classList.remove('hidden');
    };

    document.getElementById('btn-close-settings').onclick = () => settingsModal.classList.add('hidden');
    document.getElementById('settings-modal-overlay').onclick = () => settingsModal.classList.add('hidden');

    document.getElementById('btn-add-rule').onclick = () => {
        const day = parseInt(document.getElementById('rule-day').value);
        const type = document.getElementById('rule-type').value;
        const frequency = document.getElementById('rule-frequency').value;
        const start = document.getElementById('rule-start').value;
        const desc = document.getElementById('rule-desc').value.trim();

        if (!start) {
            alert("A Data de Início é obrigatória para calcular a escala.");
            return;
        }

        // We can have multiple rules now, just append it
        state.config.fixedRules.push({ dayOfWeek: day, type, frequency, start, desc });
        state.config.fixedRules.sort((a,b) => {
            if(a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
            return a.start.localeCompare(b.start);
        });
        
        document.getElementById('rule-desc').value = '';
        renderRulesList();
        saveStateToCloud();
    };

    window.calendar = {
        exportEvent: (eventId) => {
            const evt = state.events.find(e => e.id === eventId);
            if (!evt) return;
            const dateObj = new Date(evt.date);
            const dateStr = dateObj.toISOString().replace(/-/g, '').split('T')[0];
            const endDateObj = new Date(dateObj);
            endDateObj.setDate(endDateObj.getDate() + 1);
            const endDateStr = endDateObj.toISOString().replace(/-/g, '').split('T')[0];

            const icsContent = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Agenda Mel 2026//PT',
                'BEGIN:VEVENT',
                `DTSTART;VALUE=DATE:${dateStr}`,
                `DTEND;VALUE=DATE:${endDateStr}`,
                `SUMMARY:${evt.title}`,
                `DESCRIPTION:${evt.time ? 'Horário: ' + evt.time + '\\n' : ''}${evt.description || ''}`,
                'END:VEVENT',
                'END:VCALENDAR'
            ].join('\r\n');

            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `evento_${evt.title.replace(/\s+/g, '_')}.ics`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },
        removeRule: (idx) => {
            state.config.fixedRules.splice(idx, 1);
            renderRulesList();
            saveStateToCloud();
        },
        deleteEvent: (id) => {
            if (confirm('Tem certeza que deseja excluir este evento?')) {
                state.events = state.events.filter(e => e.id !== id);
                renderDayEventsList();
                saveStateToCloud();
            }
        },
        editEvent: (id) => {
            const evt = state.events.find(e => e.id === id);
            if (evt) {
                document.getElementById('day-event-id').value = evt.id;
                document.getElementById('day-event-title').value = evt.title;
                document.getElementById('day-event-desc').value = evt.description || '';
                document.getElementById('day-event-time').value = evt.time || '';
                document.getElementById('day-event-end').value = '';
                document.getElementById('day-event-end-container').classList.add('hidden');
                
                document.getElementById('btn-save-day-event').textContent = 'Atualizar Evento';
                document.getElementById('btn-cancel-edit-event').classList.remove('hidden');
                document.getElementById('btn-save-day-event').classList.remove('w-full');
                document.getElementById('btn-save-day-event').classList.add('w-2/3');
                
                const formContainer = document.getElementById('add-event-form-container');
                const iconToggle = document.getElementById('icon-toggle-add-event');
                if (formContainer && formContainer.classList.contains('hidden')) {
                    formContainer.classList.remove('hidden');
                    if (iconToggle) iconToggle.classList.add('rotate-180');
                }
                
                document.getElementById('add-event-section').scrollIntoView({behavior: 'smooth'});
            }
        }
    };

    // --- Search & Filters ---
    const filterHasEvents = document.getElementById('filter-has-events');
    const filterShowPastNormal = document.getElementById('filter-show-past-normal');

    btnToggleFilters.onclick = (e) => {
        e.stopPropagation();
        filtersPanel.classList.toggle('hidden');
    };

    document.addEventListener('click', (e) => {
        if (!filtersPanel.contains(e.target) && !btnToggleFilters.contains(e.target)) {
            filtersPanel.classList.add('hidden');
        }
    });

    const updateSearch = () => {
        state.search.query = searchInput.value.trim();
        state.search.start = filterStart.value;
        state.search.end = filterEnd.value;
        state.search.status = filterStatus.value;
        state.search.hasEventsOnly = filterHasEvents ? filterHasEvents.checked : false;
        state.search.showPastNormal = filterShowPastNormal ? filterShowPastNormal.checked : false;
        renderCalendar();
    };

    searchInput.addEventListener('input', updateSearch);
    filterStart.addEventListener('change', updateSearch);
    filterEnd.addEventListener('change', updateSearch);
    filterStatus.addEventListener('change', updateSearch);
    if (filterHasEvents) {
        filterHasEvents.addEventListener('change', updateSearch);
    }
    if (filterShowPastNormal) {
        filterShowPastNormal.addEventListener('change', updateSearch);
    }

    const btnExportAll = document.getElementById('btn-export-all');
    if (btnExportAll) {
        btnExportAll.addEventListener('click', () => {
            if (state.events.length === 0) {
                alert("Não há eventos para exportar.");
                return;
            }
            const icsLines = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Agenda Mel//PT'
            ];
            state.events.forEach(evt => {
                const dateObj = new Date(evt.date);
                const dateStr = dateObj.toISOString().replace(/-/g, '').split('T')[0];
                const endDateObj = new Date(dateObj);
                endDateObj.setDate(endDateObj.getDate() + 1);
                const endDateStr = endDateObj.toISOString().replace(/-/g, '').split('T')[0];
                
                icsLines.push('BEGIN:VEVENT');
                icsLines.push(`DTSTART;VALUE=DATE:${dateStr}`);
                icsLines.push(`DTEND;VALUE=DATE:${endDateStr}`);
                icsLines.push(`SUMMARY:${evt.title}`);
                if(evt.time || evt.description) {
                    icsLines.push(`DESCRIPTION:${evt.time ? 'Horário: ' + evt.time + '\\n' : ''}${evt.description || ''}`);
                }
                icsLines.push('END:VEVENT');
            });
            icsLines.push('END:VCALENDAR');

            const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `AgendaMel_Completa.ics`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    }

    // --- Init ---
    btnToday.addEventListener('click', () => {
        const todayStr = getTodayStr();
        const el = document.getElementById(`day-${todayStr}`);
        if (el) {
            const monthContent = el.closest('.month-content');
            const sep = monthContent ? monthContent.previousElementSibling : null;
            if (monthContent && monthContent.classList.contains('hidden')) {
                const toggleArea = sep ? sep.querySelector('.accordion-toggle-area') : null;
                if (toggleArea) toggleArea.click();
            }
            
            setTimeout(() => {
                if (sep) {
                    sep.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
                el.classList.add('ring-4', 'ring-indigo-400', 'ring-offset-2', 'transition-all');
                setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-400', 'ring-offset-2'), 2000);
            }, 100);
        }
    });

    async function initialize() {
        loadingIndicator.classList.remove('hidden');
        try {
            const cloudData = await window.api.fetchEvents();
            
            if (cloudData && cloudData.config) {
                const hasCloudData = (cloudData.events && cloudData.events.length > 0) || 
                                     (cloudData.config.fixedRules && cloudData.config.fixedRules.length > 0);
                
                if (hasCloudData) {
                    // Nuvem tem dados (eventos ou regras), carregar da nuvem
                    state.events = cloudData.events || [];
                    state.config = cloudData.config;
                    if (state.config.appTitle) {
                        appTitleDisplay.textContent = state.config.appTitle;
                    }
                } else {
                    // Nuvem está vazia. Tentar carregar fallback local ou criar semente
                    const savedRules = localStorage.getItem('melConfigRules2');
                    if(savedRules) {
                        state.config.fixedRules = JSON.parse(savedRules);
                    } else {
                        state.config.fixedRules = [
                            { dayOfWeek: 6, type: 'Com Filhos', frequency: 'quinzenal', start: '2026-05-09', desc: 'Fim de semana alternado' },
                            { dayOfWeek: 0, type: 'Com Filhos', frequency: 'quinzenal', start: '2026-05-10', desc: 'Fim de semana alternado' },
                            { dayOfWeek: 6, type: 'Sem Filhos', frequency: 'quinzenal', start: '2026-05-16', desc: 'Fim de semana alternado' },
                            { dayOfWeek: 0, type: 'Sem Filhos', frequency: 'quinzenal', start: '2026-05-17', desc: 'Fim de semana alternado' }
                        ];
                    }
                    saveStateToCloud();
                }
            } else {
                 // Fallback if cloudData is completely malformed
                 throw new Error("Dados da nuvem malformados");
            }

            state.isReady = true;
            renderCalendar();
        } catch (error) {
            rootEl.innerHTML = `<div class="p-8 text-center text-red-500">Erro ao carregar eventos da nuvem. Verifique o console.</div>`;
        } finally {
            loadingIndicator.classList.add('hidden');
            // Clicar no botão 'Hoje' após 1 segundo da primeira carga
            setTimeout(() => {
                if (btnToday) btnToday.click();
            }, 1000);
        }
    }

    btnEditTitle.addEventListener('click', () => {
        const newTitle = prompt('Digite o novo título da agenda:', state.config.appTitle || 'Agenda Mel');
        if (newTitle !== null && newTitle.trim() !== '') {
            state.config.appTitle = newTitle.trim();
            appTitleDisplay.textContent = state.config.appTitle;
            saveStateToCloud();
        }
    });

    initialize();
});
