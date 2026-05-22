(function () {
  const vscode = acquireVsCodeApi();
  const PAGE_SIZE = 100;

  let currentTable = null;
  let currentOffset = 0;
  let currentTotal = 0;

  const tablesEl = document.getElementById("tables");
  const titleEl = document.getElementById("table-title");
  const pagerEl = document.getElementById("pager");
  const dataEl = document.getElementById("data");

  function send(type, payload) {
    vscode.postMessage({ type, payload });
  }

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
    requestData();
  }

  function requestData() {
    send("getTableData", {
      table: currentTable,
      limit: PAGE_SIZE,
      offset: currentOffset,
    });
  }

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

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    payload.columns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    dataEl.appendChild(thead);

    const tbody = document.createElement("tbody");
    payload.rows.forEach((row) => {
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
    dataEl.appendChild(tbody);

    renderPager();
  }

  function renderPager() {
    const start = currentTotal === 0 ? 0 : currentOffset + 1;
    const end = Math.min(currentOffset + PAGE_SIZE, currentTotal);
    pagerEl.innerHTML = "";

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

  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "tables":
        renderTables(msg.payload);
        break;
      case "tableData":
        renderData(msg.payload);
        break;
      case "error":
        titleEl.textContent = `Error: ${msg.payload.message}`;
        break;
    }
  });

  send("listTables");
})();
