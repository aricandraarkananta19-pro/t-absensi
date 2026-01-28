import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

interface ExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  columns: ExportColumn[];
  data: Record<string, string | number>[];
  orientation?: "portrait" | "landscape";
}

export const exportToCSV = (options: ExportOptions) => {
  const { filename, columns, data } = options;
  
  // BOM for UTF-8 encoding (Excel compatibility)
  const BOM = "\uFEFF";
  
  // Headers
  const headers = columns.map(col => col.header);
  
  // Rows
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      // Escape quotes and wrap in quotes if contains comma or newline
      const stringValue = String(value ?? "-");
      if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    })
  );

  // Combine with separator
  const csvContent = BOM + [
    headers.join(";"), // Using semicolon for better Excel compatibility
    ...rows.map(row => row.join(";"))
  ].join("\n");

  // Create and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportToPDF = (options: ExportOptions) => {
  const { title, subtitle, filename, columns, data, orientation = "portrait" } = options;
  
  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, 20, { align: "center" });
  
  // Subtitle
  if (subtitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, pageWidth / 2, 28, { align: "center" });
  }

  // Date generated
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Dicetak: ${new Date().toLocaleDateString("id-ID", { 
    weekday: "long", 
    year: "numeric", 
    month: "long", 
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })}`, pageWidth / 2, subtitle ? 35 : 28, { align: "center" });

  // Table
  const tableHeaders = columns.map(col => col.header);
  const tableData = data.map(row => 
    columns.map(col => String(row[col.key] ?? "-"))
  );

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: subtitle ? 42 : 35,
    theme: "grid",
    headStyles: {
      fillColor: [59, 130, 246], // Primary blue
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Light gray
    },
    columnStyles: columns.reduce((acc, col, index) => {
      if (col.width) {
        acc[index] = { cellWidth: col.width };
      }
      return acc;
    }, {} as Record<number, { cellWidth: number }>),
    margin: { top: 40, left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer with page number
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Halaman ${data.pageNumber} dari ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    },
  });

  // Save
  doc.save(`${filename}.pdf`);
};

export const exportToExcel = (options: ExportOptions) => {
  const { title, subtitle, filename, columns, data } = options;
  
  // Create XML for Excel with styling
  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Title">
      <Font ss:Bold="1" ss:Size="14"/>
      <Alignment ss:Horizontal="Center"/>
    </Style>
    <Style ss:ID="Subtitle">
      <Font ss:Size="11"/>
      <Alignment ss:Horizontal="Center"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#3B82F6" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Data">
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="DataAlt">
      <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
  </Styles>
  <Worksheet ss:Name="Laporan">
    <Table>`;

  // Column widths
  const colWidths = columns.map(col => 
    `<Column ss:AutoFitWidth="1" ss:Width="${col.width || 100}"/>`
  ).join("");

  // Title row
  const titleRow = `<Row>
    <Cell ss:MergeAcross="${columns.length - 1}" ss:StyleID="Title">
      <Data ss:Type="String">${title}</Data>
    </Cell>
  </Row>`;

  // Subtitle row
  const subtitleRow = subtitle ? `<Row>
    <Cell ss:MergeAcross="${columns.length - 1}" ss:StyleID="Subtitle">
      <Data ss:Type="String">${subtitle}</Data>
    </Cell>
  </Row>` : "";

  // Empty row
  const emptyRow = `<Row><Cell><Data ss:Type="String"></Data></Cell></Row>`;

  // Header row
  const headerRow = `<Row>
    ${columns.map(col => 
      `<Cell ss:StyleID="Header"><Data ss:Type="String">${col.header}</Data></Cell>`
    ).join("")}
  </Row>`;

  // Data rows
  const dataRows = data.map((row, index) => 
    `<Row>
      ${columns.map(col => {
        const value = row[col.key];
        const isNumber = typeof value === "number";
        return `<Cell ss:StyleID="${index % 2 === 0 ? "Data" : "DataAlt"}">
          <Data ss:Type="${isNumber ? "Number" : "String"}">${value ?? "-"}</Data>
        </Cell>`;
      }).join("")}
    </Row>`
  ).join("");

  const xmlFooter = `
    </Table>
  </Worksheet>
</Workbook>`;

  const xmlContent = xmlHeader + colWidths + titleRow + subtitleRow + emptyRow + headerRow + dataRows + xmlFooter;

  // Download
  const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(link.href);
};