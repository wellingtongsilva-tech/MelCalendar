/**
 * Main calendar logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & State ---
    const YEAR = 2026;
    const ANCHOR_DATE = new Date(YEAR, 4, 9); // 2026-05-09 is index 4 for May
    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    
    let state = {
        events: [],
        searchQuery: '',
        isReady: false
    };

    // --- DOM Elements ---
    const rootEl = document.getElementById('calendar-root');
    const searchInput = document.getElementById('search-input');
    const btnToday = document.getElementById('btn-today');
    const loadingIndicator = document.getElementById('loading-indicator');

    // --- Core Logic ---

    // Generate all days of the year grouped by week (Monday-Sunday)
    function generateCalendarData() {
        const weeks = [];
        let currentWeek = [];
        
        // Find the first Monday of the calendar (might be in late 2025)
        const firstDayOfYear = new Date(YEAR, 0, 1);
        const firstDayOfWeek = firstDayOfYear.getDay(); // 0 is Sunday
        
        // Calculate offset to previous Monday
        // getDay(): Sun=0, Mon=1, ..., Sat=6
        // We want Mon=0, Tue=1, ..., Sun=6
        let offsetToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
        
        let currentDate = new Date(YEAR, 0, 1 - offsetToMonday);
        
        // Loop until we cover the entire year
        while (currentDate.getFullYear() <= YEAR || currentWeek.length > 0) {
            // Stop if we are in the next year AND we've just finished a week
            if (currentDate.getFullYear() > YEAR && currentWeek.length === 0) {
                break;
            }

            const dayInfo = {
                date: new Date(currentDate),
                dateStr: formatDateStr(currentDate),
                isCurrentYear: currentDate.getFullYear() === YEAR,
                isWeekend: currentDate.getDay() === 0 || currentDate.getDay() === 6
            };
            
            // Calculate weekend logic based on anchor date
            if (dayInfo.isWeekend) {
                dayInfo.weekendType = calculateWeekendType(currentDate);
            }

            currentWeek.push(dayInfo);

            if (currentWeek.length === 7) {
                weeks.push([...currentWeek]);
                currentWeek = [];
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return weeks;
    }

    function calculateWeekendType(date) {
        // Find the Saturday of the week of the given date
        const d = new Date(date);
        if (d.getDay() === 0) {
            d.setDate(d.getDate() - 1); // Move Sunday back to Saturday
        } else if (d.getDay() !== 6) {
             // Not weekend, shouldn't be called, but just in case
             return null;
        }

        // Anchor is 2026-05-09 (Saturday) -> "Com Filhos" (Assuming this as base)
        const anchorSaturday = new Date(ANCHOR_DATE);
        
        // Reset time to avoid daylight saving issues
        d.setHours(0,0,0,0);
        anchorSaturday.setHours(0,0,0,0);
        
        const diffMs = d.getTime() - anchorSaturday.getTime();
        const diffWeeks = Math.round(diffMs / MS_PER_WEEK);
        
        // Even difference in weeks means same type as anchor
        return (diffWeeks % 2 === 0) ? 'Com Filhos' : 'Sem Filhos';
    }

    function formatDateStr(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function getTodayStr() {
        const today = new Date();
        // Since we are mocking for 2026, let's pretend today is somewhere in 2026 if it's not
        // This makes the demo better
        const demoToday = today.getFullYear() === 2026 ? today : new Date(2026, 4, 15); // May 15, 2026 as fallback today
        return formatDateStr(demoToday);
    }

    // --- Rendering ---

    function renderCalendar() {
        rootEl.innerHTML = '';
        
        if (!state.isReady) return;

        const weeks = generateCalendarData();
        let currentMonth = -1;
        const todayStr = getTodayStr();

        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        weeks.forEach((week, weekIndex) => {
            // Check if we need a month separator
            // Usually we add separator if the majority of the week belongs to a new month
            // Or simply if the Thursday of the week is in a new month
            const thursday = week[3].date;
            if (thursday.getFullYear() === YEAR && thursday.getMonth() !== currentMonth) {
                currentMonth = thursday.getMonth();
                
                const sep = document.createElement('div');
                sep.className = 'month-separator';
                sep.innerHTML = `<span>${monthNames[currentMonth]} ${YEAR}</span>`;
                rootEl.appendChild(sep);
            }

            const weekRow = document.createElement('div');
            weekRow.className = 'grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden shadow-sm animate-fade-in calendar-grid';
            weekRow.style.animationDelay = `${(weekIndex % 10) * 20}ms`;

            week.forEach(day => {
                const isToday = day.dateStr === todayStr;
                const isDimmed = !day.isCurrentYear;
                
                // Filter events for this day
                const dayEvents = state.events.filter(e => e.date === day.dateStr);
                
                // Filter by search query
                const filteredEvents = dayEvents.filter(e => {
                    if (!state.searchQuery) return true;
                    const query = state.searchQuery.toLowerCase();
                    return e.title.toLowerCase().includes(query) || 
                           (e.description && e.description.toLowerCase().includes(query));
                });

                // Determine if we should dim this day entirely due to search
                const hasSearchQuery = state.searchQuery.length > 0;
                const hasMatchingEvents = filteredEvents.length > 0;
                const dimDueToSearch = hasSearchQuery && !hasMatchingEvents;

                const dayCell = document.createElement('div');
                dayCell.className = `calendar-day relative bg-white p-2 border-b border-r border-gray-100 last:border-r-0 flex flex-col gap-1 
                                     ${isDimmed ? 'bg-gray-50/50 text-gray-400' : ''} 
                                     ${isToday ? 'day-today' : ''}
                                     ${dimDueToSearch ? 'opacity-30' : 'opacity-100'}`;
                
                // Ensure it has an ID for scrolling
                dayCell.id = `day-${day.dateStr}`;

                // Top row: Date number and weekend label
                let weekendLabelHtml = '';
                if (day.weekendType && day.isWeekend && !isDimmed) {
                    const labelClass = day.weekendType === 'Com Filhos' ? 'label-com-filhos' : 'label-sem-filhos';
                    weekendLabelHtml = `<span class="weekend-label ${labelClass}">${day.weekendType}</span>`;
                }

                let dateNumHtml = `<div class="date-number text-sm font-semibold mb-1 ${isDimmed ? 'text-gray-400' : 'text-gray-700'}">${day.date.getDate()}</div>`;
                
                if (day.date.getDate() === 1 && !isDimmed) {
                    dateNumHtml = `<div class="date-number text-sm font-semibold mb-1 text-gray-700">${day.date.getDate()} ${monthNames[day.date.getMonth()].substr(0,3)}</div>`;
                }

                const headerHtml = `
                    <div class="flex justify-between items-start">
                        ${dateNumHtml}
                        <div class="flex flex-col items-end">
                            ${weekendLabelHtml}
                        </div>
                    </div>
                `;

                // Events
                let eventsHtml = '';
                filteredEvents.forEach(evt => {
                    eventsHtml += `
                        <div class="event-item event-has-appointment" onclick="window.calendar.exportEvent(${evt.id})" title="Clique para exportar .ics">
                            <div class="font-semibold truncate">${highlightText(evt.title, state.searchQuery)}</div>
                            ${evt.description ? `<div class="text-[10px] text-gray-500 line-clamp-2 mt-0.5">${highlightText(evt.description, state.searchQuery)}</div>` : ''}
                        </div>
                    `;
                });

                dayCell.innerHTML = headerHtml + eventsHtml;
                weekRow.appendChild(dayCell);
            });

            rootEl.appendChild(weekRow);
        });
    }

    function highlightText(text, query) {
        if (!query || !text) return text;
        const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
        return text.replace(regex, '<span class="search-match">$1</span>');
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // --- Actions ---

    async function initialize() {
        loadingIndicator.classList.remove('hidden');
        try {
            state.events = await window.api.fetchEvents();
            state.isReady = true;
            renderCalendar();
            scrollToToday(false); // don't smooth scroll on initial load
        } catch (error) {
            rootEl.innerHTML = `<div class="p-8 text-center text-red-500">Erro ao carregar eventos. Verifique o console.</div>`;
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    }

    function scrollToToday(smooth = true) {
        const todayStr = getTodayStr();
        const el = document.getElementById(`day-${todayStr}`);
        if (el) {
            // Adjust offset for fixed header
            const headerOffset = 120;
            const elementPosition = el.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
  
            window.scrollTo({
                 top: offsetPosition,
                 behavior: smooth ? "smooth" : "auto"
            });
            
            // Add a brief highlight flash
            el.classList.add('ring-4', 'ring-indigo-300', 'ring-offset-2', 'transition-all', 'duration-500');
            setTimeout(() => {
                el.classList.remove('ring-4', 'ring-indigo-300', 'ring-offset-2');
            }, 1500);
        }
    }

    function exportEventToICS(eventId) {
        const evt = state.events.find(e => e.id === eventId);
        if (!evt) return;

        // Simple ICS generation
        const dateObj = new Date(evt.date);
        // Format: YYYYMMDD
        const dateStr = dateObj.toISOString().replace(/-/g, '').split('T')[0];
        
        // Add one day for end date since it's an all-day event
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
            `DESCRIPTION:${evt.description || ''}`,
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
    }

    // --- Event Listeners ---

    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        renderCalendar();
    });

    btnToday.addEventListener('click', () => {
        scrollToToday(true);
    });

    // --- Add Event Modal Logic ---
    const btnAddEvent = document.getElementById('btn-add-event');
    const modal = document.getElementById('add-event-modal');
    const btnCancelEvent = document.getElementById('btn-cancel-event');
    const btnSaveEvent = document.getElementById('btn-save-event');
    const form = document.getElementById('add-event-form');

    function openModal() {
        modal.classList.remove('hidden');
        if (!document.getElementById('event-start').value) {
            document.getElementById('event-start').value = getTodayStr();
        }
    }

    function closeModal() {
        modal.classList.add('hidden');
        form.reset();
    }

    if (btnAddEvent) btnAddEvent.addEventListener('click', openModal);
    if (btnCancelEvent) btnCancelEvent.addEventListener('click', closeModal);
    
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.addEventListener('click', closeModal);

    if (btnSaveEvent) {
        btnSaveEvent.addEventListener('click', () => {
            const title = document.getElementById('event-title').value.trim();
            const desc = document.getElementById('event-desc').value.trim();
            const start = document.getElementById('event-start').value;
            const end = document.getElementById('event-end').value;

            if (!title || !start) {
                alert('Título e Data Início são obrigatórios.');
                return;
            }

            // Parse dates ignoring timezones to prevent day-shifting
            const startDate = new Date(start + 'T00:00:00');
            const endDate = end ? new Date(end + 'T00:00:00') : new Date(startDate);
            
            if (endDate < startDate) {
                alert('A Data Fim deve ser maior ou igual à Data Início.');
                return;
            }

            // Create events for each day in the range
            let current = new Date(startDate);
            let maxId = state.events.length > 0 ? Math.max(...state.events.map(e => e.id)) : 0;

            while (current <= endDate) {
                state.events.push({
                    id: ++maxId,
                    date: formatDateStr(current),
                    title: title,
                    description: desc
                });
                current.setDate(current.getDate() + 1);
            }

            // Note: Currently saving locally to state. To persist, add API call here.
            
            renderCalendar();
            closeModal();
            
            // Scroll to the first day of the new event
            setTimeout(() => {
                const el = document.getElementById(`day-${start}`);
                if (el) {
                    const headerOffset = 120;
                    const elementPosition = el.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                    
                    el.classList.add('ring-4', 'ring-violet-300', 'ring-offset-2', 'transition-all', 'duration-500');
                    setTimeout(() => el.classList.remove('ring-4', 'ring-violet-300', 'ring-offset-2'), 1500);
                }
            }, 100);
        });
    }

    // Expose export function globally
    window.calendar = {
        exportEvent: exportEventToICS
    };

    // --- Boot ---
    initialize();
});
