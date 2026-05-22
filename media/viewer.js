(function () {
  const vscode = acquireVsCodeApi();
  const PAGE_SIZE = 100;

  let currentTable = null;
  let currentOffset = 0;
  let currentTotal = 0;
  let activeTab = "data";

  let currentColumns = [];
  let currentMetadata = null;
  let currentKeyValues = [];
  let pendingEdit = null;

  let currentSortColumn = null;
  let currentSortDirection = null;
  let currentFilters = {};
  let filterDebounceTimer = null;

  const tablesEl = document.getElementById("tables");
  const titleEl = document.getElementById("table-title");
  const badgeEl = document.getElementById("data-badge");
  const pagerEl = document.getElementById("pager");
  const dataEl = document.getElementById("data");
  const sqlInput = document.getElementById("sql-input");
  const runBtn = document.getElementById("run-btn");
  const queryStatus = document.getElementById("query-status");
  const queryResults = document.getElementById("query-results");
  const dataExportEl = document.getElementById("data-export");
  const queryExportEl = document.getElementById("query-export");

  let lastQueryResult = null;

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
    currentSortColumn = null;
    currentSortDirection = null;
    currentFilters = {};
    document.querySelectorAll("#tables li").forEach((el) => {
      el.classList.toggle("active", el.textContent === name);
    });
    switchTab("data");
    requestData();
  }

  function requestData() {
    if (!currentTable) return;
    const filters = Object.entries(currentFilters)
      .filter(([, v]) => v !== "")
      .map(([column, value]) => ({ column, value }));
    send("getTableData", {
      table: currentTable,
      limit: PAGE_SIZE,
      offset: currentOffset,
      sortColumn: currentSortColumn ?? undefined,
      sortDirection: currentSortDirection ?? undefined,
      filters,
    });
  }

  /* data table render --------------------------------------------- */

  function renderData(payload) {
    if (payload.table !== currentTable) return;

    const sameSchema =
      currentColumns.length === payload.columns.length &&
      currentColumns.every((c, i) => c === payload.columns[i]);

    currentTotal = payload.total;
    currentColumns = payload.columns;
    currentMetadata = payload.metadata;
    currentKeyValues = payload.keyValues;
    pendingEdit = null;

    titleEl.textContent = `${payload.table}  ·  ${payload.total} rows`;
    badgeEl.textContent = "";
    badgeEl.className = "";
    if (payload.metadata.isView) {
      badgeEl.textContent = "view · read-only";
      badgeEl.className = "badge readonly";
    } else if (!payload.metadata.editable) {
      badgeEl.textContent = "no primary key · read-only";
      badgeEl.className = "badge readonly";
    }
    dataExportEl.hidden = payload.total === 0 && !hasActiveFilters();

    if (payload.columns.length === 0) {
      dataEl.innerHTML = "";
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.className = "empty";
      td.textContent = "Empty table";
      tr.appendChild(td);
      dataEl.appendChild(tr);
      renderPager();
      return;
    }

    if (sameSchema && dataEl.querySelector("thead")) {
      const oldTbody = dataEl.querySelector("tbody");
      if (oldTbody) oldTbody.remove();
      appendEditableBody(
        dataEl,
        payload.rows,
        payload.columns,
        payload.metadata,
      );
      updateSortIndicators();
    } else {
      dataEl.innerHTML = "";
      appendSortableHead(dataEl, payload.columns);
      appendFilterRow(dataEl, payload.columns);
      appendEditableBody(
        dataEl,
        payload.rows,
        payload.columns,
        payload.metadata,
      );
    }
    renderPager();
  }

  function hasActiveFilters() {
    return Object.values(currentFilters).some((v) => v !== "");
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

  function appendSortableHead(table, columns) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    columns.forEach((col, idx) => {
      const th = document.createElement("th");
      th.className = "sortable";
      th.dataset.col = String(idx);
      th.dataset.colname = col;

      const label = document.createElement("span");
      label.textContent = col;
      th.appendChild(label);

      const indicator = document.createElement("span");
      indicator.className = "sort-indicator";
      indicator.textContent = "";
      th.appendChild(indicator);

      th.addEventListener("click", () => cycleSort(col));
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);
    updateSortIndicators();
  }

  function appendFilterRow(table, columns) {
    const tr = document.createElement("tr");
    tr.className = "filter-row";
    columns.forEach((col) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "filter";
      input.className = "filter-input";
      input.value = currentFilters[col] ?? "";
      input.spellcheck = false;
      input.autocomplete = "off";
      input.addEventListener("input", () => onFilterInput(col, input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          input.value = "";
          onFilterInput(col, "");
        } else if (e.key === "Enter") {
          flushFilterDebounce();
        }
      });
      td.appendChild(input);
      tr.appendChild(td);
    });
    const existingThead = table.querySelector("thead");
    if (existingThead) existingThead.appendChild(tr);
  }

  function onFilterInput(column, value) {
    currentFilters[column] = value;
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => {
      filterDebounceTimer = null;
      currentOffset = 0;
      requestData();
    }, 250);
  }

  function flushFilterDebounce() {
    if (filterDebounceTimer) {
      clearTimeout(filterDebounceTimer);
      filterDebounceTimer = null;
      currentOffset = 0;
      requestData();
    }
  }

  function cycleSort(column) {
    if (currentSortColumn !== column) {
      currentSortColumn = column;
      currentSortDirection = "asc";
    } else if (currentSortDirection === "asc") {
      currentSortDirection = "desc";
    } else {
      currentSortColumn = null;
      currentSortDirection = null;
    }
    currentOffset = 0;
    requestData();
  }

  function updateSortIndicators() {
    document.querySelectorAll("th.sortable").forEach((th) => {
      const indicator = th.querySelector(".sort-indicator");
      if (!indicator) return;
      if (th.dataset.colname === currentSortColumn) {
        indicator.textContent = currentSortDirection === "asc" ? " ▲" : " ▼";
        th.classList.add("sorted");
      } else {
        indicator.textContent = "";
        th.classList.remove("sorted");
      }
    });
  }

  function appendTableBody(table, rows) {
    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        tr.appendChild(buildReadonlyCell(cell));
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function appendEditableBody(table, rows, columnNames, metadata) {
    const tbody = document.createElement("tbody");
    const colInfo = new Map(metadata.columns.map((c) => [c.name, c]));

    rows.forEach((row, rowIdx) => {
      const tr = document.createElement("tr");
      row.forEach((cell, colIdx) => {
        const colName = columnNames[colIdx];
        const info = colInfo.get(colName);
        const isBlob = info && /blob/i.test(info.type);
        const td = buildReadonlyCell(cell, isBlob);
        td.dataset.row = String(rowIdx);
        td.dataset.col = String(colIdx);
        if (metadata.editable && !isBlob) {
          td.classList.add("editable");
          td.addEventListener("dblclick", () => startEdit(td, info));
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function buildReadonlyCell(cell, isBlob = false) {
    const td = document.createElement("td");
    if (cell === null || cell === undefined) {
      td.textContent = "NULL";
      td.className = "null";
    } else if (isBlob || cell instanceof Uint8Array) {
      const len = cell instanceof Uint8Array ? cell.length : "?";
      td.textContent = `<BLOB ${len} bytes>`;
      td.className = "blob";
    } else {
      td.textContent = String(cell);
    }
    return td;
  }

  /* inline editing ------------------------------------------------ */

  function startEdit(td, columnInfo) {
    if (td.classList.contains("editing")) return;
    if (pendingEdit) return;

    const rowIdx = Number(td.dataset.row);
    const colIdx = Number(td.dataset.col);
    const colName = currentColumns[colIdx];
    const wasNull = td.classList.contains("null");
    const originalText = td.textContent;
    const originalClass = td.className;

    td.classList.add("editing");
    td.classList.remove("null");

    const input = document.createElement("input");
    input.type = inputTypeFor(columnInfo);
    input.value = wasNull ? "" : originalText;
    input.spellcheck = false;
    input.autocomplete = "off";

    td.textContent = "";
    td.appendChild(input);
    input.focus();
    input.select();

    let finished = false;

    const cancel = () => {
      if (finished) return;
      finished = true;
      td.classList.remove("editing");
      td.className = originalClass;
      td.textContent = originalText;
    };

    const commit = () => {
      if (finished) return;
      finished = true;

      const raw = input.value;
      let newValue;
      if (raw === "") {
        if (columnInfo && columnInfo.notnull) {
          if (isNumericType(columnInfo)) {
            td.classList.remove("editing");
            td.className = originalClass;
            td.textContent = originalText;
            flashError(td, "NOT NULL column needs a value");
            return;
          }
          newValue = "";
        } else {
          newValue = null;
        }
      } else if (isNumericType(columnInfo)) {
        const parsed = Number(raw);
        if (Number.isNaN(parsed)) {
          td.classList.remove("editing");
          td.className = originalClass;
          td.textContent = originalText;
          flashError(td, "Not a number");
          return;
        }
        newValue = parsed;
      } else {
        newValue = raw;
      }

      pendingEdit = {
        td,
        rowIdx,
        colIdx,
        colName,
        originalText,
        originalClass,
        newValue,
      };

      td.classList.remove("editing");
      td.classList.add("saving");
      td.textContent =
        newValue === null ? "NULL" : String(newValue);
      if (newValue === null) td.classList.add("null");

      send("updateCell", {
        table: currentTable,
        column: colName,
        newValue,
        keyColumns: currentMetadata.keyColumns,
        keyValues: currentKeyValues[rowIdx],
      });
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });
    input.addEventListener("blur", commit);
  }

  function isNumericType(info) {
    if (!info || !info.type) return false;
    return /\b(int|real|float|double|numeric|decimal)\b/i.test(info.type);
  }

  function inputTypeFor(info) {
    return isNumericType(info) ? "number" : "text";
  }

  function flashError(td, message) {
    td.classList.add("flash-error");
    badgeEl.textContent = message;
    badgeEl.className = "badge error";
    setTimeout(() => {
      td.classList.remove("flash-error");
      if (badgeEl.textContent === message) {
        badgeEl.textContent = "";
        badgeEl.className = "";
      }
    }, 1800);
  }

  function handleUpdateCellResult(payload) {
    if (!pendingEdit) return;
    const { td, originalText, originalClass } = pendingEdit;
    td.classList.remove("saving");

    if (payload.rowsModified === 0) {
      td.className = originalClass;
      td.textContent = originalText;
      flashError(td, "No rows updated — row may have been removed");
    }
    pendingEdit = null;
  }

  function handleEditError(message) {
    if (!pendingEdit) return;
    const { td, originalText, originalClass } = pendingEdit;
    td.classList.remove("saving");
    td.className = originalClass;
    td.textContent = originalText;
    flashError(td, message);
    pendingEdit = null;
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

  /* export -------------------------------------------------------- */

  document.querySelectorAll(".export-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const format = btn.dataset.format;
      const target = btn.dataset.target;
      if (target === "query") {
        if (!lastQueryResult) return;
        send("exportQuery", {
          columns: lastQueryResult.columns,
          rows: lastQueryResult.rows,
          format,
          defaultName: `query.${format}`,
        });
      } else {
        if (!currentTable) return;
        send("exportTable", { table: currentTable, format });
      }
    });
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
    lastQueryResult = null;
    queryExportEl.hidden = true;

    if (results.length === 0) {
      const summary = mutated
        ? `OK · ${rowsModified} row(s) modified · ${durationMs} ms · document marked as modified`
        : `OK · ${durationMs} ms`;
      queryStatus.className = mutated ? "mutated" : "";
      queryStatus.textContent = summary;
      return;
    }

    lastQueryResult = results[0];
    queryExportEl.hidden = results[0].rows.length === 0;

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
      case "updateCellResult":
        handleUpdateCellResult(msg.payload);
        break;
      case "schemaChanged":
        send("listTables");
        if (currentTable) requestData();
        break;
      case "error":
        if (pendingEdit) {
          handleEditError(msg.payload.message);
        } else {
          runBtn.disabled = false;
          queryStatus.className = "error";
          queryStatus.textContent = `Error: ${msg.payload.message}`;
        }
        break;
    }
  });

  send("listTables");
})();
