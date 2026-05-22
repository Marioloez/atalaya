(function () {
  const vscode = acquireVsCodeApi();
  const PAGE_SIZE = 100;

  let currentTable = null;
  let currentOffset = 0;
  let currentTotal = 0;
  let activeTab = "data";

  const tablesEl = document.getElementById("tables");
  const titleEl = document.getElementById("table-title");
  const pagerEl = document.getElementById("pager");
  const dataEl = document.getElementById("data");
  const sqlInput = document.getElementById("sql-input");
  const runBtn = document.getElementById("run-btn");
  const queryStatus = document.getElementById("query-status");
  const queryResults = document.getElementById("query-results");

  function send(type, payload) {
    vscode.postMessage({ type, payload });
  }

  /* sidebar -------------------------------------------------------- */

  function renderTables(tables) {
    tablesEl.innerHTML = "";
    if (tables.length === 0) {
      const li = document.createElement("li");
      li.textContent = "(no tables)";
      li.style.opacity = "0.6";
      tablesEl.appendChild(li);
      return;
    }
    tables.forEach((name) => {
      const li = document.createElement("li");
      li.textContent = name;
      if (name === currentTable) li.classList.add("active");
      li.addEventListener("click", () => openTable(name));
      tablesEl.appendChild(li);
    });
  }

  function openTable(name) {
    currentTable = name;
    currentOffset = 0;
    document.querySelectorAll("#tables li").forEach((el) => {
      el.classList.toggle("active", el.textContent === name);
    });
    switchTab("data");
    requestData();
  }

  function requestData() {
    if (!currentTable) return;
    send("getTableData", {
      table: currentTable,
      limit: PAGE_SIZE,
      offset: currentOffset,
    });
  }

  /* data table render --------------------------------------------- */

  function renderData(payload) {
    if (payload.table !== currentTable) return;
    currentTotal = payload.total;
    titleEl.textContent = `${payload.table}  ·  ${payload.total} rows`;

    dataEl.innerHTML = "";

    if (payload.columns.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.className = "empty";
      td.textContent = "Empty table";
      tr.appendChild(td);
      dataEl.appendChild(tr);
      renderPager();
      return;
    }

    appendTableHead(dataEl, payload.columns);
    appendTableBody(dataEl, payload.rows);
    renderPager();
  }

  function renderPager() {
    pagerEl.innerHTML = "";
    if (activeTab !== "data" || !currentTable) return;

    const start = currentTotal === 0 ? 0 : currentOffset + 1;
    const end = Math.min(currentOffset + PAGE_SIZE, currentTotal);

    const info = document.createElement("span");
    info.className = "info";
    info.textContent = `${start}–${end} of ${currentTotal}`;
    pagerEl.appendChild(info);

    const prev = document.createElement("button");
    prev.textContent = "◀";
    prev.title = "Previous page";
    prev.disabled = currentOffset === 0;
    prev.addEventListener("click", () => {
      currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
      requestData();
    });
    pagerEl.appendChild(prev);

    const next = document.createElement("button");
    next.textContent = "▶";
    next.title = "Next page";
    next.disabled = end >= currentTotal;
    next.addEventListener("click", () => {
      currentOffset += PAGE_SIZE;
      requestData();
    });
    pagerEl.appendChild(next);
  }

  function appendTableHead(table, columns) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    columns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col;
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);
  }

  function appendTableBody(table, rows) {
    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        const td = document.createElement("td");
        if (cell === null) {
          td.textContent = "NULL";
          td.className = "null";
        } else {
          td.textContent = String(cell);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  /* tabs ---------------------------------------------------------- */

  function switchTab(name) {
    activeTab = name;
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === name);
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.toggle("active", p.id === `tab-${name}`);
    });
    renderPager();
  }

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  /* query --------------------------------------------------------- */

  function runQuery() {
    const sql = sqlInput.value.trim();
    if (!sql) return;
    runBtn.disabled = true;
    queryStatus.className = "";
    queryStatus.textContent = "Running...";
    send("runQuery", { sql });
  }

  runBtn.addEventListener("click", runQuery);

  sqlInput.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runQuery();
    }
  });

  function renderQueryResult(payload) {
    runBtn.disabled = false;

    const { results, rowsModified, mutated, durationMs } = payload;
    queryResults.innerHTML = "";

    if (results.length === 0) {
      const summary = mutated
        ? `OK · ${rowsModified} row(s) modified · ${durationMs} ms · document marked as modified`
        : `OK · ${durationMs} ms`;
      queryStatus.className = mutated ? "mutated" : "";
      queryStatus.textContent = summary;
      return;
    }

    queryStatus.className = mutated ? "mutated" : "";
    const total = results.reduce((sum, r) => sum + r.rows.length, 0);
    queryStatus.textContent = mutated
      ? `${total} row(s) returned · ${rowsModified} row(s) modified · ${durationMs} ms`
      : `${total} row(s) · ${durationMs} ms`;

    results.forEach((rs, idx) => {
      const section = document.createElement("section");
      section.className = "result-set";

      if (results.length > 1) {
        const h3 = document.createElement("h3");
        h3.textContent = `Result ${idx + 1}`;
        section.appendChild(h3);
      }

      const table = document.createElement("table");
      if (rs.columns.length > 0) {
        appendTableHead(table, rs.columns);
        appendTableBody(table, rs.rows);
      } else {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.className = "empty";
        td.textContent = "(no rows)";
        tr.appendChild(td);
        table.appendChild(tr);
      }
      section.appendChild(table);
      queryResults.appendChild(section);
    });
  }

  /* incoming messages --------------------------------------------- */

  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "tables":
        renderTables(msg.payload);
        break;
      case "tableData":
        renderData(msg.payload);
        break;
      case "queryResult":
        renderQueryResult(msg.payload);
        break;
      case "schemaChanged":
        // refresh sidebar and current table view
        send("listTables");
        if (currentTable) requestData();
        break;
      case "error":
        runBtn.disabled = false;
        queryStatus.className = "error";
        queryStatus.textContent = `Error: ${msg.payload.message}`;
        break;
    }
  });

  send("listTables");
})();
