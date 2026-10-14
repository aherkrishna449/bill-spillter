/**
 * Bill Splitter - Pure Vanilla JavaScript Implementation
 * 100% Offline, Exact Paisa Distribution, Robust Validation & LocalStorage Persistence.
 */

(function () {
  'use strict';

  // DOM Elements
  const form = document.getElementById('bill-form');
  const occasionInput = document.getElementById('occasion-name');
  const billAmountInput = document.getElementById('bill-amount');
  const numPeopleInput = document.getElementById('num-people');
  const splitBtn = document.getElementById('split-btn');
  const resetBtn = document.getElementById('reset-btn');
  const copyBtn = document.getElementById('copy-btn');
  const printBtn = document.getElementById('print-btn');
  const decrementPeopleBtn = document.getElementById('decrement-people');
  const incrementPeopleBtn = document.getElementById('increment-people');
  const errorBox = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');

  const resultPlaceholder = document.getElementById('result-placeholder');
  const resultContent = document.getElementById('result-content');
  const restoredBanner = document.getElementById('restored-banner');
  const closeBannerBtn = document.getElementById('close-banner-btn');

  // Result display fields
  const heroAmount = document.getElementById('hero-amount');
  const heroNote = document.getElementById('hero-note');
  const resOccasion = document.getElementById('res-occasion');
  const resTotalBill = document.getElementById('res-total-bill');
  const resPeople = document.getElementById('res-people');
  const resBaseShare = document.getElementById('res-base-share');
  const resRoundingNote = document.getElementById('res-rounding-note');
  const resVerificationSum = document.getElementById('res-verification-sum');
  const personList = document.getElementById('person-list');

  // Preset buttons
  const presetButtons = document.querySelectorAll('.preset-btn');

  // Storage Key
  const STORAGE_KEY = 'bill_splitter_latest_result';

  /**
   * Format numbers to Indian / standard rupee representation
   * @param {number} num
   * @param {number} decimals
   * @returns {string}
   */
  function formatCurrency(num, decimals = 2) {
    if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
      return '0.00';
    }
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  /**
   * Hide the error message and remove error highlights from inputs
   */
  function clearError() {
    if (errorBox) {
      errorBox.classList.remove('visible');
    }
    if (errorText) {
      errorText.textContent = '';
    }
    if (billAmountInput) {
      billAmountInput.classList.remove('input-error');
      billAmountInput.removeAttribute('aria-invalid');
    }
    if (numPeopleInput) {
      numPeopleInput.classList.remove('input-error');
      numPeopleInput.removeAttribute('aria-invalid');
    }
    if (occasionInput) {
      occasionInput.classList.remove('input-error');
    }
  }

  /**
   * Display a clear, user-friendly error message and highlight culprit inputs
   * @param {string} message
   * @param {HTMLElement|null} fieldToFocus
   */
  function showError(message, fieldToFocus = null) {
    if (errorText) {
      errorText.textContent = message;
    }
    if (errorBox) {
      errorBox.classList.add('visible');
    }

    if (fieldToFocus) {
      fieldToFocus.classList.add('input-error');
      fieldToFocus.setAttribute('aria-invalid', 'true');
      fieldToFocus.focus();
    }
  }

  /**
   * Validate inputs according to strict rules
   * @returns {{ valid: boolean, occasion?: string, bill?: number, people?: number }}
   */
  function validateInputs() {
    clearError();

    // Check for HTML5 badInput states (non-numeric entries in number inputs)
    const billBadInput = billAmountInput.validity && billAmountInput.validity.badInput;
    const peopleBadInput = numPeopleInput.validity && numPeopleInput.validity.badInput;

    if (billBadInput) {
      showError('Please enter a valid numeric bill amount.', billAmountInput);
      return { valid: false };
    }

    if (peopleBadInput) {
      showError('Please enter a valid whole number of people.', numPeopleInput);
      return { valid: false };
    }

    const occasionVal = occasionInput.value.trim();
    const billRaw = billAmountInput.value.trim().replace(/,/g, '');
    const peopleRaw = numPeopleInput.value.trim();

    // Check 1: Both empty
    if (billRaw === '' && peopleRaw === '') {
      showError('Please enter both the total bill amount and the number of people.', billAmountInput);
      return { valid: false };
    }

    // Check 2: Bill amount empty
    if (billRaw === '') {
      showError('Please enter the total bill amount.', billAmountInput);
      return { valid: false };
    }

    // Check 3: Bill amount numeric parsing
    const billNum = Number(billRaw);
    if (isNaN(billNum) || !isFinite(billNum)) {
      showError('Please enter a valid numeric bill amount.', billAmountInput);
      return { valid: false };
    }

    // Check 4: Bill amount <= 0
    if (billNum === 0) {
      showError('Total bill amount must be greater than zero (0 rs is not valid).', billAmountInput);
      return { valid: false };
    }
    if (billNum < 0) {
      showError('Total bill amount cannot be negative. Please enter a positive amount.', billAmountInput);
      return { valid: false };
    }

    // Check 5: Number of people empty
    if (peopleRaw === '') {
      showError('Please enter the number of people.', numPeopleInput);
      return { valid: false };
    }

    // Check 6: Number of people numeric parsing
    const peopleNum = Number(peopleRaw);
    if (isNaN(peopleNum) || !isFinite(peopleNum)) {
      showError('Please enter a valid number of people.', numPeopleInput);
      return { valid: false };
    }

    // Check 7: Number of people <= 0
    if (peopleNum === 0) {
      showError('Number of people must be at least 1 person.', numPeopleInput);
      return { valid: false };
    }
    if (peopleNum < 0) {
      showError('Number of people cannot be negative. Please enter 1 or more people.', numPeopleInput);
      return { valid: false };
    }

    // Check 8: Number of people must be whole number
    if (!Number.isInteger(peopleNum)) {
      showError('Number of people must be a positive whole number (cannot have fractional people).', numPeopleInput);
      return { valid: false };
    }

    // Check 9: Bill sanity upper limit
    if (billNum > 100000000000) {
      showError('Bill amount is too large to process safely.', billAmountInput);
      return { valid: false };
    }

    // Standardize bill to 2 decimal places to match real currency
    const normalizedBill = Math.round(billNum * 100) / 100;

    return {
      valid: true,
      occasion: occasionVal,
      bill: normalizedBill,
      people: peopleNum,
    };
  }

  /**
   * Perform exact division with zero rounding error by distributing leftover paise
   * @param {number} bill
   * @param {number} people
   */
  function calculateSplit(bill, people) {
    // Convert bill to paise (integer) to eliminate IEEE-754 floating point imprecision
    const totalPaise = Math.round(bill * 100);
    const basePaise = Math.floor(totalPaise / people);
    const remainderPaise = totalPaise % people;

    const baseShareRs = basePaise / 100;
    const extraShareRs = (basePaise + 1) / 100;

    // Create array of individual shares
    const shares = [];
    let sumPaise = 0;

    for (let i = 1; i <= people; i++) {
      const isExtra = i <= remainderPaise;
      const sharePaise = isExtra ? basePaise + 1 : basePaise;
      sumPaise += sharePaise;

      shares.push({
        personNumber: i,
        amount: sharePaise / 100,
        isExtra: isExtra,
      });
    }

    const calculatedSum = sumPaise / 100;

    return {
      totalBill: bill,
      totalPaise: totalPaise,
      people: people,
      baseShare: baseShareRs,
      extraShare: extraShareRs,
      remainderPaise: remainderPaise,
      dividesEqually: remainderPaise === 0,
      shares: shares,
      calculatedSum: calculatedSum,
    };
  }

  /**
   * Render the calculation results in the UI
   */
  function renderResult(data, occasion) {
    const displayOccasion = occasion && occasion.trim().length > 0 ? occasion.trim() : 'General Expense (Not specified)';
    const totalFormatted = formatCurrency(data.totalBill);
    const baseShareFormatted = formatCurrency(data.baseShare);
    const extraShareFormatted = formatCurrency(data.extraShare);
    const sumFormatted = formatCurrency(data.calculatedSum);

    // Update Hero Amount
    if (data.dividesEqually) {
      heroAmount.textContent = `${baseShareFormatted} rs`;
      heroNote.textContent = `Exact equal split across all ${data.people} ${data.people === 1 ? 'person' : 'people'}.`;
    } else {
      heroAmount.textContent = `${baseShareFormatted} rs`;
      heroNote.textContent = `Base share: ${baseShareFormatted} rs (${data.remainderPaise} ${data.remainderPaise === 1 ? 'person pays' : 'people pay'} ${extraShareFormatted} rs to settle remaining ${data.remainderPaise} paise).`;
    }

    // Update Summary Details
    resOccasion.textContent = displayOccasion;
    resTotalBill.textContent = `${totalFormatted} rs`;
    resPeople.textContent = `${data.people} ${data.people === 1 ? 'person' : 'people'}`;

    if (data.dividesEqually) {
      resBaseShare.textContent = `${baseShareFormatted} rs each`;
      resRoundingNote.textContent = 'Exact equal split (0 paise remainder)';
    } else {
      resBaseShare.textContent = `${baseShareFormatted} rs - ${extraShareFormatted} rs`;
      resRoundingNote.textContent = `${data.remainderPaise} person(s) pay ${extraShareFormatted} rs, ${data.people - data.remainderPaise} pay ${baseShareFormatted} rs`;
    }

    // Exact Match Verification
    resVerificationSum.textContent = `${sumFormatted} rs (Matches entered bill of ${totalFormatted} rs exactly)`;

    // Populate Individual Breakdown
    personList.innerHTML = '';

    const limit = 50;
    const countToShow = Math.min(data.shares.length, limit);

    for (let i = 0; i < countToShow; i++) {
      const shareItem = data.shares[i];
      const li = document.createElement('li');
      li.className = 'person-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'person-name';
      nameSpan.textContent = `Person ${shareItem.personNumber}`;

      if (shareItem.isExtra) {
        const extraTag = document.createElement('span');
        extraTag.className = 'tag-extra';
        extraTag.textContent = '+1p exact';
        nameSpan.appendChild(extraTag);
      }

      const shareSpan = document.createElement('span');
      shareSpan.className = shareItem.isExtra ? 'person-share has-extra' : 'person-share';
      shareSpan.textContent = `${formatCurrency(shareItem.amount)} rs`;

      li.appendChild(nameSpan);
      li.appendChild(shareSpan);
      personList.appendChild(li);
    }

    if (data.shares.length > limit) {
      const liMore = document.createElement('li');
      liMore.className = 'person-item';
      liMore.style.fontStyle = 'italic';
      liMore.style.color = 'var(--text-muted)';
      liMore.textContent = `... and ${data.shares.length - limit} more people paying ${baseShareFormatted} rs`;
      personList.appendChild(liMore);
    }

    // Swap placeholder with result
    resultPlaceholder.style.display = 'none';
    resultContent.classList.add('visible');
  }

  /**
   * Save calculation result to localStorage
   */
  function saveToStorage(occasion, bill, people, calculation) {
    try {
      const payload = {
        occasion: occasion,
        bill: bill,
        people: people,
        calculation: calculation,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Unable to write to localStorage:', e);
    }
  }

  /**
   * Load saved result from localStorage on startup
   */
  function restoreFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || typeof data.bill !== 'number' || typeof data.people !== 'number') return;

      // Populate input fields
      occasionInput.value = data.occasion || '';
      billAmountInput.value = data.bill;
      numPeopleInput.value = data.people;

      // Update preset buttons state
      updatePresetButtons(data.people);

      // Perform fresh calculation to guarantee exact match
      const calculation = calculateSplit(data.bill, data.people);
      renderResult(calculation, data.occasion);

      // Show restored banner
      if (restoredBanner) {
        restoredBanner.classList.add('visible');
      }
    } catch (e) {
      console.warn('Failed to restore from localStorage:', e);
    }
  }

  /**
   * Clear all inputs, results, and localStorage
   */
  function handleReset() {
    // Clear inputs
    occasionInput.value = '';
    billAmountInput.value = '';
    numPeopleInput.value = '';

    // Clear preset button active state
    presetButtons.forEach(btn => btn.classList.remove('active'));

    // Clear error
    clearError();

    // Hide result & show placeholder
    resultContent.classList.remove('visible');
    resultPlaceholder.style.display = 'flex';

    // Hide restored banner
    if (restoredBanner) {
      restoredBanner.classList.remove('visible');
    }

    // Remove from localStorage
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Could not remove from localStorage:', e);
    }

    // Focus back on bill amount
    billAmountInput.focus();
  }

  /**
   * Handle Split Bill button click
   */
  function handleSplit() {
    // Hide restored banner when a new calculation happens
    if (restoredBanner) {
      restoredBanner.classList.remove('visible');
    }

    const val = validateInputs();
    if (!val.valid) {
      // Invalidate visible results on invalid input so old results are not shown
      resultContent.classList.remove('visible');
      resultPlaceholder.style.display = 'flex';
      return;
    }

    // Calculate split
    const calculation = calculateSplit(val.bill, val.people);

    // Render results
    renderResult(calculation, val.occasion);

    // Persist to localStorage
    saveToStorage(val.occasion, val.bill, val.people, calculation);
  }

  /**
   * Sync active preset button with current number of people
   */
  function updatePresetButtons(peopleCount) {
    presetButtons.forEach(btn => {
      const count = parseInt(btn.dataset.count, 10);
      if (count === peopleCount) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Increment or decrement number of people
   */
  function stepPeople(delta) {
    clearError();
    const currentVal = parseInt(numPeopleInput.value.trim(), 10);
    let nextVal = isNaN(currentVal) ? 1 : currentVal + delta;
    if (nextVal < 1) nextVal = 1;
    numPeopleInput.value = nextVal;
    updatePresetButtons(nextVal);
  }

  /**
   * Copy summary to clipboard
   */
  function handleCopy() {
    const occasion = resOccasion.textContent;
    const total = resTotalBill.textContent;
    const people = resPeople.textContent;
    const each = heroAmount.textContent;

    const summaryText = `Bill Splitter Summary:\n` +
      `Occasion: ${occasion}\n` +
      `Total Bill: ${total}\n` +
      `Number of People: ${people}\n` +
      `Each Person Pays: ${each}\n` +
      `Verification: ${resVerificationSum.textContent}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(summaryText).then(() => {
        const originalContent = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="color: var(--success);">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Copied!</span>
        `;
        setTimeout(() => {
          copyBtn.innerHTML = originalContent;
        }, 2000);
      }).catch(() => {
        prompt('Copy your split summary below:', summaryText);
      });
    } else {
      prompt('Copy your split summary below:', summaryText);
    }
  }

  /**
   * Trigger print dialog
   */
  function handlePrint() {
    window.print();
  }

  // Event Listeners
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    handleSplit();
  });

  splitBtn.addEventListener('click', function (e) {
    e.preventDefault();
    handleSplit();
  });

  resetBtn.addEventListener('click', function (e) {
    e.preventDefault();
    handleReset();
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', handleCopy);
  }

  if (printBtn) {
    printBtn.addEventListener('click', handlePrint);
  }

  if (decrementPeopleBtn) {
    decrementPeopleBtn.addEventListener('click', function () {
      stepPeople(-1);
    });
  }

  if (incrementPeopleBtn) {
    incrementPeopleBtn.addEventListener('click', function () {
      stepPeople(1);
    });
  }

  if (closeBannerBtn) {
    closeBannerBtn.addEventListener('click', function () {
      restoredBanner.classList.remove('visible');
    });
  }

  // Preset buttons click
  presetButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const count = this.dataset.count;
      numPeopleInput.value = count;
      updatePresetButtons(parseInt(count, 10));
      clearError();
    });
  });

  // Clear errors when user edits inputs
  billAmountInput.addEventListener('input', function () {
    clearError();
  });

  numPeopleInput.addEventListener('input', function () {
    clearError();
    const count = parseInt(this.value, 10);
    updatePresetButtons(count);
  });

  occasionInput.addEventListener('input', function () {
    clearError();
  });

  // Enter key trigger on inputs
  [occasionInput, billAmountInput, numPeopleInput].forEach(input => {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSplit();
      }
    });
  });

  // On page load: restore saved state from localStorage
  document.addEventListener('DOMContentLoaded', function () {
    restoreFromStorage();
  });

  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    restoreFromStorage();
  }
})();
