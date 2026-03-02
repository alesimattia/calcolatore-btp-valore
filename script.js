(function () {
    'use strict';

    // === CONFIGURAZIONE BTP VALORE 7ª EMISSIONE ===
    const START_DATE = new Date(2026, 2, 10);    // 10 marzo 2026 (godimento)
    const MATURITY_DATE = new Date(2032, 2, 10);  // 10 marzo 2032 (scadenza)
    const TOTAL_QUARTERS = 24;

    // Tassi annui lordi minimi garantiti per fascia (step-up)
    const RATE_TIERS = [
        { fromQuarter: 1,  toQuarter: 8,  annualRate: 0.025 },  // Anno 1-2: 2,50%
        { fromQuarter: 9,  toQuarter: 16, annualRate: 0.028 },  // Anno 3-4: 2,80%
        { fromQuarter: 17, toQuarter: 24, annualRate: 0.035 }   // Anno 5-6: 3,50%
    ];

    const LOYALTY_PREMIUM_RATE = 0.008;  // 0,80% del nominale
    const TAX_RATE = 0.125;              // 12,5% tassazione agevolata
    const MIN_INVESTMENT = 1000;         // Taglio/lotto minimo €1.000

    const MONTHS_IT = [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];

    // === ELEMENTI DOM ===
    const capitalInput = document.getElementById('capital');
    const monthSelect = document.getElementById('month');
    const yearSelect = document.getElementById('year');
    const capitalMsg = document.getElementById('capitalMsg');
    const resultsCard = document.getElementById('resultsCard');
    const resultsPlaceholder = document.getElementById('resultsPlaceholder');
    const resultsContent = document.getElementById('resultsContent');
    const timelineFill = document.getElementById('timelineFill');
    const timelineDetail = document.getElementById('timelineDetail');

    // === UTILITÀ ===

    /** Formatta un numero come valuta italiana */
    function formatCurrency(amount) {
        return '€ ' + amount.toLocaleString('it-IT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /** Restituisce tutte le 24 date di pagamento cedola */
    function getCouponDates() {
        const dates = [];
        for (let i = 1; i <= TOTAL_QUARTERS; i++) {
            // Ogni 3 mesi a partire dal godimento (marzo 2026)
            dates.push(new Date(2026, 2 + i * 3, 10));
        }
        return dates;
    }

    /** Restituisce il tasso annuo lordo per un dato trimestre (1-24) */
    function getAnnualRate(quarterNum) {
        for (const tier of RATE_TIERS) {
            if (quarterNum >= tier.fromQuarter && quarterNum <= tier.toQuarter) {
                return tier.annualRate;
            }
        }
        return 0;
    }

    /** Differenza in giorni tra due date */
    function daysBetween(d1, d2) {
        return Math.round((d2 - d1) / 86400000);
    }

    // Calcolo date cedola (cache)
    const COUPON_DATES = getCouponDates();

    // === CALCOLO PRINCIPALE ===

    /**
     * Calcola il rendimento del BTP Valore dato un capitale e una data di ritiro.
     * Restituisce un oggetto con tutti i dettagli del calcolo.
     */
    function calculate(capital, withdrawMonth, withdrawYear) {
        // Ultimo giorno del mese selezionato come data di ritiro
        const withdrawDate = new Date(withdrawYear, withdrawMonth + 1, 0);
        const isAtMaturity = withdrawDate >= MATURITY_DATE;

        let grossCouponsFromCompleted = 0;
        let completedQuarters = 0;

        // Conta le cedole trimestrali completate
        for (let i = 0; i < TOTAL_QUARTERS; i++) {
            if (COUPON_DATES[i] <= withdrawDate) {
                completedQuarters++;
                const quarterlyRate = getAnnualRate(i + 1) / 4;
                grossCouponsFromCompleted += capital * quarterlyRate;
            }
        }

        // Rateo di cedola per il trimestre parziale
        let accruedInterest = 0;
        if (completedQuarters < TOTAL_QUARTERS && !isAtMaturity) {
            const lastDate = completedQuarters === 0 ? START_DATE : COUPON_DATES[completedQuarters - 1];
            const nextDate = COUPON_DATES[completedQuarters];
            const elapsed = daysBetween(lastDate, withdrawDate);
            const total = daysBetween(lastDate, nextDate);

            if (elapsed > 0 && total > 0) {
                const quarterlyRate = getAnnualRate(completedQuarters + 1) / 4;
                accruedInterest = capital * quarterlyRate * (elapsed / total);
            }
        }

        // Totale interessi lordi (cedole + rateo)
        const totalGrossInterest = grossCouponsFromCompleted + accruedInterest;
        const taxOnInterest = totalGrossInterest * TAX_RATE;
        const netInterest = totalGrossInterest - taxOnInterest;

        // Premio fedeltà (solo a scadenza)
        const loyaltyGross = isAtMaturity ? capital * LOYALTY_PREMIUM_RATE : 0;
        const loyaltyTax = loyaltyGross * TAX_RATE;
        const loyaltyNet = loyaltyGross - loyaltyTax;

        // Totale futuro
        const totalFutureValue = capital + netInterest + loyaltyNet;
        const totalNetGain = netInterest + loyaltyNet;

        // Percentuale periodo trascorso (per la barra)
        const totalDays = daysBetween(START_DATE, MATURITY_DATE);
        const elapsedDays = Math.min(daysBetween(START_DATE, withdrawDate), totalDays);
        const progressPercent = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));

        return {
            grossCoupons: totalGrossInterest,
            grossCouponsCompleted: grossCouponsFromCompleted,
            accruedInterest: accruedInterest,
            taxOnInterest: taxOnInterest,
            netInterest: netInterest,
            loyaltyGross: loyaltyGross,
            loyaltyTax: loyaltyTax,
            loyaltyNet: loyaltyNet,
            capitalReturned: capital,
            totalFutureValue: totalFutureValue,
            totalNetGain: totalNetGain,
            isAtMaturity: isAtMaturity,
            completedQuarters: completedQuarters,
            progressPercent: progressPercent
        };
    }

    // === AGGIORNAMENTO INTERFACCIA ===

    /** Aggiorna i selettori dei mesi in base all'anno scelto */
    function updateMonthOptions() {
        const year = parseInt(yearSelect.value);
        const currentMonth = parseInt(monthSelect.value);

        // Range mesi validi: marzo 2026 - marzo 2032
        let startMonth = 0;
        let endMonth = 11;
        if (year === 2026) startMonth = 2;  // Da marzo
        if (year === 2032) endMonth = 2;    // Fino a marzo

        monthSelect.innerHTML = '';
        for (let m = startMonth; m <= endMonth; m++) {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = MONTHS_IT[m];
            monthSelect.appendChild(opt);
        }

        // Mantieni la selezione corrente se possibile
        if (!isNaN(currentMonth) && currentMonth >= startMonth && currentMonth <= endMonth) {
            monthSelect.value = currentMonth;
        } else if (currentMonth < startMonth) {
            monthSelect.value = startMonth;
        } else {
            monthSelect.value = endMonth;
        }
    }

    /** Aggiorna la descrizione del periodo nella barra temporale */
    function updateTimelineText(withdrawMonth, withdrawYear) {
        const startY = 2026, startM = 2; // Marzo 2026 (0-indexed)
        const totalMonths = (withdrawYear - startY) * 12 + (withdrawMonth - startM);

        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;

        let text = 'Periodo di detenzione: ';
        if (years > 0 && months > 0) {
            text += years + (years === 1 ? ' anno' : ' anni') + ' e ' + months + (months === 1 ? ' mese' : ' mesi');
        } else if (years > 0) {
            text += years + (years === 1 ? ' anno' : ' anni');
        } else if (months > 0) {
            text += months + (months === 1 ? ' mese' : ' mesi');
        } else {
            text = 'Data di godimento (inizio investimento)';
        }

        timelineDetail.textContent = text;
    }

    /** Mostra o nasconde i risultati con animazione fade-in */
    function displayResults(result) {
        resultsPlaceholder.style.display = 'none';
        resultsContent.style.display = 'block';

        // Aggiorna tutti i valori
        document.getElementById('totalValue').textContent = formatCurrency(result.totalFutureValue);
        document.getElementById('totalGain').textContent = 'Guadagno netto: + ' + formatCurrency(result.totalNetGain);

        // Badge fedeltà
        const loyaltyBadge = document.getElementById('loyaltyBadge');
        const noLoyaltyMsg = document.getElementById('noLoyaltyMsg');
        if (result.isAtMaturity) {
            loyaltyBadge.classList.remove('hidden');
            noLoyaltyMsg.classList.add('hidden');
        } else {
            loyaltyBadge.classList.add('hidden');
            noLoyaltyMsg.classList.remove('hidden');
        }

        // Dettaglio cedole
        const couponsLabel = result.completedQuarters === TOTAL_QUARTERS
            ? 'Cedole lorde (24 trimestri)'
            : 'Interessi lordi maturati (' + result.completedQuarters + ' cedole su 24)';
        document.querySelector('#bkGrossCoupons').parentElement.querySelector('span:first-child').textContent = couponsLabel;
        document.getElementById('bkGrossCoupons').textContent = formatCurrency(result.grossCoupons);

        // Rateo (visibile solo se presente)
        const accruedRow = document.getElementById('bkAccruedRow');
        if (result.accruedInterest > 0.005) {
            accruedRow.style.display = 'flex';
            document.getElementById('bkAccrued').textContent = formatCurrency(result.accruedInterest);
        } else {
            accruedRow.style.display = 'none';
        }

        document.getElementById('bkCouponTax').textContent = '− ' + formatCurrency(result.taxOnInterest);
        document.getElementById('bkNetCoupons').textContent = formatCurrency(result.netInterest);

        // Sezione premio fedeltà
        const loyaltyRows = document.getElementById('loyaltyRows');
        if (result.isAtMaturity) {
            loyaltyRows.style.display = 'block';
            document.getElementById('bkLoyaltyGross').textContent = formatCurrency(result.loyaltyGross);
            document.getElementById('bkLoyaltyTax').textContent = '− ' + formatCurrency(result.loyaltyTax);
            document.getElementById('bkLoyaltyNet').textContent = formatCurrency(result.loyaltyNet);
        } else {
            loyaltyRows.style.display = 'none';
        }

        document.getElementById('bkCapital').textContent = formatCurrency(result.capitalReturned);
        document.getElementById('bkTotal').textContent = formatCurrency(result.totalFutureValue);

        // Barra temporale
        timelineFill.style.width = result.progressPercent.toFixed(1) + '%';
    }

    /** Mostra il placeholder quando l'input non è valido */
    function showPlaceholder(message) {
        resultsPlaceholder.textContent = message;
        resultsPlaceholder.style.display = 'block';
        resultsContent.style.display = 'none';
    }

    // === TRIGGER CALCOLO CON ANIMAZIONE ===
    let debounceTimer;

    function triggerCalculation() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
            const rawCapital = parseFloat(capitalInput.value);

            // Validazione capitale
            if (isNaN(rawCapital) || rawCapital <= 0) {
                capitalMsg.textContent = '';
                capitalMsg.className = 'validation-msg';
                showPlaceholder('Inserisci un importo per visualizzare il rendimento');
                return;
            }

            if (rawCapital < MIN_INVESTMENT) {
                capitalMsg.textContent = 'L\'importo minimo di investimento è € 1.000';
                capitalMsg.className = 'validation-msg error';
                showPlaceholder('L\'importo minimo di investimento è € 1.000');
                return;
            }

            // Arrotonda a multipli di €1.000
            const capital = Math.floor(rawCapital / MIN_INVESTMENT) * MIN_INVESTMENT;
            if (capital !== rawCapital) {
                capitalMsg.textContent = 'Importo arrotondato a ' + formatCurrency(capital) + ' (multipli di € 1.000)';
                capitalMsg.className = 'validation-msg warning';
            } else {
                capitalMsg.textContent = '';
                capitalMsg.className = 'validation-msg';
            }

            const withdrawMonth = parseInt(monthSelect.value);
            const withdrawYear = parseInt(yearSelect.value);

            // Aggiorna testo barra temporale
            updateTimelineText(withdrawMonth, withdrawYear);

            // Calcola
            const result = calculate(capital, withdrawMonth, withdrawYear);

            // Animazione fade-in: rimuovi e riaggiungi la classe per ritriggerare l'animazione
            resultsCard.classList.remove('fade-in');
            // Forza il reflow per riavviare l'animazione CSS
            void resultsCard.offsetWidth;
            resultsCard.classList.add('fade-in');

            displayResults(result);
        }, 250); // Debounce di 250ms per evitare calcoli ad ogni tasto
    }

    // === INIZIALIZZAZIONE ===

    function init() {
        // Popola anni (2026-2032)
        for (let y = 2026; y <= 2032; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSelect.appendChild(opt);
        }

        // Default: scadenza (marzo 2032)
        yearSelect.value = '2032';
        updateMonthOptions();
        monthSelect.value = '2'; // Marzo (0-indexed)

        // Event listener
        capitalInput.addEventListener('input', triggerCalculation);
        monthSelect.addEventListener('change', triggerCalculation);
        yearSelect.addEventListener('change', function () {
            updateMonthOptions();
            triggerCalculation();
        });

        // Calcolo iniziale
        triggerCalculation();
    }

    // Avvia quando il DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
