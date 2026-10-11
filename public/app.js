document.addEventListener('DOMContentLoaded', () => {
  // State
  let allBooks = [];
  let currentDb = 'library';
  let currentCollection = 'books';

  // Elements
  const statusPill = document.getElementById('server-status-pill');
  const statusLabel = document.getElementById('status-label');
  const dbLabel = document.getElementById('db-label');
  const collLabel = document.getElementById('coll-label');
  const booksCountBadge = document.getElementById('books-count-badge');
  const labTerminalOutput = document.getElementById('lab-terminal-output');
  const snapshotDocsList = document.getElementById('snapshot-docs-list');
  const booksGridContainer = document.getElementById('books-grid-container');
  const explorerSearchInput = document.getElementById('explorer-search-input');
  const genreFilter = document.getElementById('genre-filter');
  const interactiveTerminalBody = document.getElementById('interactive-terminal-body');
  const terminalCmdInput = document.getElementById('terminal-cmd-input');
  const btnTerminalExec = document.getElementById('btn-terminal-exec');
  const btnTermClear = document.getElementById('btn-term-clear');
  const btnClearOutput = document.getElementById('btn-clear-output');
  const btnResetLab = document.getElementById('btn-reset-lab');
  const btnRunAllSteps = document.getElementById('btn-run-all-steps');
  const btnRefreshSnapshot = document.getElementById('btn-refresh-snapshot');

  // Modal elements
  const insertModal = document.getElementById('insert-modal');
  const btnOpenInsertModal = document.getElementById('btn-open-insert-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const insertBookForm = document.getElementById('insert-book-form');

  // Atlas elements
  const btnTestAtlas = document.getElementById('btn-test-atlas');
  const atlasUriInput = document.getElementById('atlas-uri-input');
  const atlasTestResult = document.getElementById('atlas-test-result');

  // Tabs Handling
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // Fetch Server Status
  async function checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.connected) {
        statusLabel.textContent = `Local MongoDB ${data.serverVersion} Online`;
        dbLabel.textContent = data.database;
        collLabel.textContent = data.collection;
        document.getElementById('stat-mongod-ver').textContent = data.serverVersion;
      } else {
        statusLabel.textContent = 'Disconnected';
      }
    } catch (err) {
      statusLabel.textContent = 'Offline';
    }
  }

  // Load Books
  async function loadBooks() {
    try {
      const res = await fetch('/api/books');
      const json = await res.json();
      if (json.success) {
        allBooks = json.data;
        booksCountBadge.textContent = allBooks.length;
        renderSnapshot(allBooks);
        renderBooksGrid(allBooks);
      }
    } catch (err) {
      console.error('Error fetching books:', err);
    }
  }

  // Render Live Snapshot in CRUD Tab
  function renderSnapshot(books) {
    if (!books || books.length === 0) {
      snapshotDocsList.innerHTML = `<div class="term-line dim-line" style="padding: 1rem; text-align: center;">Collection is empty. Run Step 2 to insert books.</div>`;
      return;
    }

    snapshotDocsList.innerHTML = books.map(b => `
      <div class="mini-book-item">
        <div>
          <div class="mini-book-title">${escapeHtml(b.title)}</div>
          <div class="mini-book-meta">${escapeHtml(b.author)} • ${b.year}</div>
        </div>
        <span class="mini-tag">${escapeHtml(b.genre || 'General')}</span>
      </div>
    `).join('');
  }

  // Render Explorer Cards
  function renderBooksGrid(books) {
    if (!booksGridContainer) return;

    if (!books || books.length === 0) {
      booksGridContainer.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
          <h3 style="color: var(--text-secondary); margin-bottom: 0.5rem;">No books in collection</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">Insert new documents using the form or run Step 2 from the CRUD tab.</p>
          <button class="btn btn-primary" onclick="document.getElementById('btn-open-insert-modal').click()">+ Add First Book</button>
        </div>
      `;
      return;
    }

    booksGridContainer.innerHTML = books.map(b => `
      <div class="book-card" id="card-${b._id}">
        <div>
          <div class="book-card-top">
            <div>
              <div class="book-title">${escapeHtml(b.title)}</div>
              <div class="book-author">by ${escapeHtml(b.author)}</div>
            </div>
            <div class="book-badges">
              <span class="badge-genre">${escapeHtml(b.genre || 'General')}</span>
              <span class="badge-year">${b.year}</span>
            </div>
          </div>
          <div style="margin-top: 0.75rem;">
            <span class="book-id-tag">_id: ${b._id}</span>
          </div>
        </div>
        <div class="book-card-actions">
          <button class="btn btn-secondary btn-xs edit-year-btn" data-id="${b._id}" data-title="${escapeHtml(b.title)}" data-year="${b.year}">
            ✎ Edit Year
          </button>
          <button class="btn btn-secondary btn-xs delete-book-btn" data-id="${b._id}" data-title="${escapeHtml(b.title)}" style="color: var(--accent-rose); border-color: rgba(244, 63, 94, 0.2);">
            ✕ Delete
          </button>
        </div>
      </div>
    `).join('');

    // Attach Event Listeners to Card Buttons
    document.querySelectorAll('.edit-year-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const title = btn.dataset.title;
        const currentYear = btn.dataset.year;
        const newYear = prompt(`Update publication year for "${title}":`, currentYear);
        if (newYear && !isNaN(newYear)) {
          await updateBookYear(id, title, Number(newYear));
        }
      });
    });

    document.querySelectorAll('.delete-book-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const title = btn.dataset.title;
        if (confirm(`Are you sure you want to delete "${title}"?`)) {
          await deleteBookById(id, title);
        }
      });
    });
  }

  // Filter Explorer
  function filterExplorer() {
    const search = (explorerSearchInput.value || '').toLowerCase().trim();
    const genre = genreFilter.value;

    const filtered = allBooks.filter(b => {
      const matchSearch = !search || 
        (b.title && b.title.toLowerCase().includes(search)) ||
        (b.author && b.author.toLowerCase().includes(search)) ||
        (b.genre && b.genre.toLowerCase().includes(search));
      const matchGenre = !genre || (b.genre && b.genre.toLowerCase() === genre.toLowerCase());
      return matchSearch && matchGenre;
    });

    renderBooksGrid(filtered);
  }

  if (explorerSearchInput) explorerSearchInput.addEventListener('input', filterExplorer);
  if (genreFilter) genreFilter.addEventListener('change', filterExplorer);

  // Terminal Logging Helper
  function logTerminal(content, type = 'normal') {
    const row = document.createElement('div');
    row.className = `term-line ${type}-line`;
    row.textContent = content;
    labTerminalOutput.appendChild(row);
    labTerminalOutput.scrollTop = labTerminalOutput.scrollHeight;
  }

  // Step Execution Logic
  const stepButtons = document.querySelectorAll('.btn-step');
  stepButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const step = btn.dataset.step;
      await executeStep(step);
    });
  });

  async function executeStep(step) {
    logTerminal(`\n>>> Executing Step ${step}...`, 'info');

    if (step === '1') {
      logTerminal('library> use library', 'cmd');
      logTerminal('switched to db library', 'success');
      logTerminal('Context set to active database: library', 'dim');
    } 
    else if (step === '2') {
      logTerminal('library> db.books.insertMany([ ... 3 books ... ])', 'cmd');
      const sampleBooks = [
        { title: "To Kill a Mockingbird", author: "Harper Lee", year: 1960, genre: "Fiction" },
        { title: "1984", author: "George Orwell", year: 1949, genre: "Dystopian" },
        { title: "The Great Gatsby", author: "F. Scott Fitzgerald", year: 1925, genre: "Classic" }
      ];
      try {
        const res = await fetch('/api/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: sampleBooks })
        });
        const data = await res.json();
        logTerminal(`{ acknowledged: true, insertedCount: ${data.result.insertedCount} }`, 'success');
        await loadBooks();
      } catch (err) {
        logTerminal(`Error: ${err.message}`, 'error');
      }
    } 
    else if (step === '3') {
      logTerminal('library> db.books.find()', 'cmd');
      try {
        const res = await fetch('/api/books');
        const json = await res.json();
        logTerminal(JSON.stringify(json.data, null, 2), 'normal');

        logTerminal('\nlibrary> db.books.find({ author: "George Orwell" })', 'cmd');
        const orwellRes = await fetch('/api/books?author=George%20Orwell');
        const orwellJson = await orwellRes.json();
        logTerminal(JSON.stringify(orwellJson.data, null, 2), 'success');
      } catch (err) {
        logTerminal(`Error: ${err.message}`, 'error');
      }
    } 
    else if (step === '4') {
      logTerminal('library> db.books.updateOne({ title: "1984" }, { $set: { year: 1950, genre: "Dystopian Fiction" } })', 'cmd');
      try {
        const res = await fetch('/api/books/1984', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year: 1950, genre: "Dystopian Fiction" })
        });
        const data = await res.json();
        logTerminal(`{ acknowledged: true, matchedCount: ${data.result.matchedCount}, modifiedCount: ${data.result.modifiedCount} }`, 'success');
        await loadBooks();
      } catch (err) {
        logTerminal(`Error: ${err.message}`, 'error');
      }
    } 
    else if (step === '5') {
      logTerminal('library> db.books.deleteOne({ title: "The Great Gatsby" })', 'cmd');
      try {
        const res = await fetch('/api/books/The%20Great%20Gatsby', {
          method: 'DELETE'
        });
        const data = await res.json();
        logTerminal(`{ acknowledged: true, deletedCount: ${data.result.deletedCount} }`, 'success');
        await loadBooks();
      } catch (err) {
        logTerminal(`Error: ${err.message}`, 'error');
      }
    } 
    else if (step === '6') {
      logTerminal('library> db.books.find().pretty()', 'cmd');
      try {
        const res = await fetch('/api/books');
        const json = await res.json();
        logTerminal(JSON.stringify(json.data, null, 2), 'success');
        logTerminal(`Verified: ${json.data.length} books remaining in collection.`, 'info');
      } catch (err) {
        logTerminal(`Error: ${err.message}`, 'error');
      }
    }
  }

  // Run Complete Workflow
  if (btnRunAllSteps) {
    btnRunAllSteps.addEventListener('click', async () => {
      btnRunAllSteps.disabled = true;
      btnRunAllSteps.textContent = 'Running Workflow...';
      logTerminal('\n========================================', 'info');
      logTerminal('🚀 Executing Full MongoDB CRUD Workflow', 'info');
      logTerminal('========================================', 'info');

      // Reset first
      await fetch('/api/reset-lab', { method: 'POST' });
      await loadBooks();

      for (let s = 1; s <= 6; s++) {
        await executeStep(String(s));
        await new Promise(r => setTimeout(r, 600));
      }

      logTerminal('\n✅ Complete CRUD Workflow Finished Successfully!', 'success');
      btnRunAllSteps.disabled = false;
      btnRunAllSteps.textContent = '▶ Run Complete Workflow';
    });
  }

  // Update & Delete APIs
  async function updateBookYear(id, title, newYear) {
    try {
      const res = await fetch(`/api/books/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: newYear })
      });
      const data = await res.json();
      if (data.success) {
        logTerminal(`\nlibrary> db.books.updateOne({ _id: ObjectId("${id}") }, { $set: { year: ${newYear} } })`, 'cmd');
        logTerminal(`Updated year for "${title}" to ${newYear}`, 'success');
        await loadBooks();
      }
    } catch (err) {
      alert('Error updating book: ' + err.message);
    }
  }

  async function deleteBookById(id, title) {
    try {
      const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        logTerminal(`\nlibrary> db.books.deleteOne({ _id: ObjectId("${id}") })`, 'cmd');
        logTerminal(`Deleted "${title}"`, 'success');
        await loadBooks();
      }
    } catch (err) {
      alert('Error deleting book: ' + err.message);
    }
  }

  // Reset Lab
  if (btnResetLab) {
    btnResetLab.addEventListener('click', async () => {
      if (confirm('Reset database collection to initial experiment state (3 books)?')) {
        try {
          const res = await fetch('/api/reset-lab', { method: 'POST' });
          const json = await res.json();
          logTerminal('\n[Reset] Collection reset to default 3 experiment documents.', 'info');
          await loadBooks();
        } catch (err) {
          alert('Reset error: ' + err.message);
        }
      }
    });
  }

  // Refresh Snapshot button
  if (btnRefreshSnapshot) {
    btnRefreshSnapshot.addEventListener('click', loadBooks);
  }

  // Clear Terminal Output
  if (btnClearOutput) {
    btnClearOutput.addEventListener('click', () => {
      labTerminalOutput.innerHTML = `<div class="term-line dim-line">Console cleared. Ready for next command.</div>`;
    });
  }

  // Insert Modal Handlers
  if (btnOpenInsertModal) {
    btnOpenInsertModal.addEventListener('click', () => insertModal.classList.remove('hidden'));
  }
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => insertModal.classList.add('hidden'));
  }
  if (btnCancelModal) {
    btnCancelModal.addEventListener('click', () => insertModal.classList.add('hidden'));
  }

  if (insertBookForm) {
    insertBookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('form-title').value.trim();
      const author = document.getElementById('form-author').value.trim();
      const year = document.getElementById('form-year').value;
      const genre = document.getElementById('form-genre').value.trim();

      try {
        const res = await fetch('/api/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, author, year, genre })
        });
        const data = await res.json();
        if (data.success) {
          insertModal.classList.add('hidden');
          insertBookForm.reset();
          logTerminal(`\nlibrary> db.books.insertOne(${JSON.stringify({ title, author, year: Number(year), genre })})`, 'cmd');
          logTerminal(`Inserted book: "${title}"`, 'success');
          await loadBooks();
        }
      } catch (err) {
        alert('Error inserting book: ' + err.message);
      }
    });
  }

  // Interactive mongosh Terminal Tab Runner
  function appendInteractiveTerm(line, type = 'normal') {
    const row = document.createElement('div');
    row.className = `term-row ${type}-line`;
    row.textContent = line;
    interactiveTerminalBody.appendChild(row);
    interactiveTerminalBody.scrollTop = interactiveTerminalBody.scrollHeight;
  }

  async function runInteractiveCmd(cmd) {
    if (!cmd || !cmd.trim()) return;
    appendInteractiveTerm(`library> ${cmd}`, 'cmd');

    try {
      const res = await fetch('/api/run-mongosh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cmd })
      });
      const data = await res.json();
      if (data.stdout) {
        appendInteractiveTerm(data.stdout, 'normal');
      }
      if (data.stderr) {
        appendInteractiveTerm(data.stderr, 'dim');
      }
      if (data.error) {
        appendInteractiveTerm(`Error: ${data.error}`, 'error');
      }
      await loadBooks();
    } catch (err) {
      appendInteractiveTerm(`Failed to execute: ${err.message}`, 'error');
    }
  }

  if (btnTerminalExec) {
    btnTerminalExec.addEventListener('click', () => {
      const cmd = terminalCmdInput.value;
      terminalCmdInput.value = '';
      runInteractiveCmd(cmd);
    });
  }

  if (terminalCmdInput) {
    terminalCmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = terminalCmdInput.value;
        terminalCmdInput.value = '';
        runInteractiveCmd(cmd);
      }
    });
  }

  // Quick Snippet Buttons
  document.querySelectorAll('.snippet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const snippet = btn.dataset.snippet;
      terminalCmdInput.value = snippet;
      runInteractiveCmd(snippet);
    });
  });

  if (btnTermClear) {
    btnTermClear.addEventListener('click', () => {
      interactiveTerminalBody.innerHTML = `
        <div class="term-row dim-line">MongoDB Shell v2.13.0</div>
        <div class="term-row dim-line">Ready.</div>
      `;
    });
  }

  // Copy Buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;
      navigator.clipboard.writeText(code);
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = originalText; }, 1500);
    });
  });

  // Atlas Tester
  if (btnTestAtlas) {
    btnTestAtlas.addEventListener('click', async () => {
      const uri = atlasUriInput.value.trim();
      if (!uri) {
        alert('Please paste a MongoDB Atlas connection string first.');
        return;
      }

      atlasTestResult.classList.remove('hidden', 'success', 'error');
      atlasTestResult.textContent = 'Connecting to MongoDB Atlas cluster...';
      btnTestAtlas.disabled = true;

      try {
        const res = await fetch('/api/test-atlas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uri })
        });
        const data = await res.json();
        if (data.success) {
          atlasTestResult.className = 'test-result-box success';
          atlasTestResult.innerHTML = `
            <strong>Connected Successfully!</strong><br>
            MongoDB Server Version: ${data.version}<br>
            Available Databases: ${data.databases.join(', ')}
          `;
        } else {
          atlasTestResult.className = 'test-result-box error';
          atlasTestResult.innerHTML = `
            <strong>Connection Failed:</strong> ${data.error}<br>
            <ul style="margin-top: 0.5rem; padding-left: 1.25rem;">
              ${data.troubleshooting.map(t => `<li>${t}</li>`).join('')}
            </ul>
          `;
        }
      } catch (err) {
        atlasTestResult.className = 'test-result-box error';
        atlasTestResult.textContent = 'Request failed: ' + err.message;
      } finally {
        btnTestAtlas.disabled = false;
      }
    });
  }

  // Utility
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Boot
  checkServerStatus();
  loadBooks();
});
