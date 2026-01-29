import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/logo.png";

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

const COMPANY_NAME = "PT. TALENTA TRAINCOM INDONESIA";
const COMPANY_DIV = "Divisi Human Resources";

// Helper to load image
const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
};

export const exportToCSV = (options: ExportOptions) => {
  const { filename, columns, data } = options;
  const BOM = "\uFEFF";
  const headers = columns.map(col => col.header);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      const stringValue = String(value ?? "-");
      if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    })
  );
  const csvContent = BOM + [headers.join(";"), ...rows.map(row => row.join(";"))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportToPDF = async (options: ExportOptions) => {
  const { title, subtitle, filename, columns, data, orientation = "portrait" } = options;

  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Load Logo
  let logoImg: HTMLImageElement | null = null;
  try {
    logoImg = await loadImage(logoUrl);
  } catch (e) {
    console.warn("Failed to load logo for PDF", e);
  }

  // --- HEADER SECTION ---
  // Logo
  if (logoImg) {
    const logoWidth = 20;
    const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
    doc.addImage(logoImg, "PNG", margin, 10, logoWidth, logoHeight);

    // Company Name (Right of logo)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175); // Corporate Blue #1E40AF
    doc.text(COMPANY_NAME, margin + logoWidth + 5, 16);

    // Division
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(COMPANY_DIV, margin + logoWidth + 5, 21);
  } else {
    // Fallback if no logo
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text(COMPANY_NAME, margin, 15);
  }

  // Report Title (Centered)
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(title.toUpperCase(), pageWidth / 2, 35, { align: "center" });

  // Subtitle
  if (subtitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, pageWidth / 2, 41, { align: "center" });
  }

  // Printed On
  const printDate = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Dicetak pada: ${printDate}`, pageWidth / 2, subtitle ? 46 : 41, { align: "center" });

  // Horizontal Line
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(margin, subtitle ? 49 : 44, pageWidth - margin, subtitle ? 49 : 44);

  // --- TABLE SECTION ---
  const tableHeaders = columns.map(col => col.header);
  const tableData = data.map(row =>
    columns.map(col => String(row[col.key] ?? "-"))
  );

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: subtitle ? 52 : 47,
    theme: "grid",
    headStyles: {
      fillColor: [30, 64, 175], // Corporate Blue #1E40AF
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 9,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: 50,
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249], // Zebra Light Gray #F1F5F9
    },
    columnStyles: columns.reduce((acc, col, index) => {
      // Manual adjustment for 'No' column or aligned columns
      const styles: any = {};
      if (col.width) styles.cellWidth = col.width;
      if (col.key === 'no' || col.key === 'total_attendance' || col.key === 'present_count' || col.key === 'late_count' || col.key === 'leave_count') {
        styles.halign = 'center';
      }
      acc[index] = styles;
      return acc;
    }, {} as Record<number, any>),
    margin: { top: 50, left: margin, right: margin, bottom: 20 },

    // --- FOOTER SECTION ---
    didDrawPage: (data) => {
      const pageNumber = doc.getNumberOfPages();

      doc.setFontSize(8);
      doc.setTextColor(100);

      // Left: System Name
      doc.text("T-Absensi System", margin, pageHeight - 10);

      // Center: Period (Subtitle)
      if (subtitle) {
        doc.text(subtitle, pageWidth / 2, pageHeight - 10, { align: "center" });
      }

      // Right: Page Number
      doc.text(`Halaman ${data.pageNumber}`, pageWidth - margin, pageHeight - 10, { align: "right" });
    },
  });

  doc.save(`${filename}.pdf`);
};

export const exportToExcel = (options: ExportOptions) => {
  const { title, subtitle, filename, columns, data } = options;

  // -- STYLING CONSTANTS --
  // Header Style: Corporate Blue background, White Bold text, Centered, Borders
  const headerStyle = `
    <Style ss:ID="Header">
      <Font ss:FontName="Arial" ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1E40AF" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A0AEC0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A0AEC0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A0AEC0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A0AEC0"/>
      </Borders>
    </Style>`;

  const titleStyle = `
    <Style ss:ID="Title">
      <Font ss:FontName="Arial" ss:Bold="1" ss:Size="14" ss:Color="#1E40AF"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
    </Style>`;

  const subtitleStyle = `
    <Style ss:ID="Subtitle">
      <Font ss:FontName="Arial" ss:Size="11" ss:Color="#4A5568"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
    </Style>`;

  // Zebra Striping Styles
  const dataStyle = `
    <Style ss:ID="Data">
      <Font ss:FontName="Arial" ss:Size="10" ss:Color="#000000"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="0.5" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="0.5" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="0.5" ss:Color="#E2E8F0"/>
      </Borders>
      <Alignment ss:Vertical="Center"/>
    </Style>`;

  const dataAltStyle = `
    <Style ss:ID="DataAlt">
      <Font ss:FontName="Arial" ss:Size="10" ss:Color="#000000"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="0.5" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="0.5" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="0.5" ss:Color="#E2E8F0"/>
      </Borders>
      <Alignment ss:Vertical="Center"/>
    </Style>`;

  // Center alignment for specific columns (No, Total, etc)
  const dataCenterStyle = `
    <Style ss:ID="DataCenter">
      <Font ss:FontName="Arial" ss:Size="10" ss:Color="#000000"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="0.5" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>`;

  const dataCenterAltStyle = `
    <Style ss:ID="DataCenterAlt">
      <Font ss:FontName="Arial" ss:Size="10" ss:Color="#000000"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="0.5" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>`;

  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Author>T-Absensi System</Author>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    ${headerStyle}
    ${titleStyle}
    ${subtitleStyle}
    ${dataStyle}
    ${dataAltStyle}
    ${dataCenterStyle}
    ${dataCenterAltStyle}
  </Styles>
  <Worksheet ss:Name="Laporan">
    <Table x:FullColumns="1" x:FullRows="1">`;

  // Columns & AutoWidth
  // Note: XML Spreadsheet doesn't strictly auto-calculate width based on content unless "AutoFitWidth" is 1, but usually needs explicit width.
  // We'll set reasonable defaults.
  const colWidths = columns.map(col => {
    let w = col.width || 100;
    // Adjust header width roughly (approximation)
    if (col.width && col.width < 50) w = 50;
    return `<Column ss:AutoFitWidth="1" ss:Width="${w * 1.5}"/>`;
  }).join("");

  // Header Rows
  // Row 1: Company
  const companyRow = `<Row ss:Height="20"><Cell ss:StyleID="Title"><Data ss:Type="String">${COMPANY_NAME.toUpperCase()}</Data></Cell></Row>`;

  // Row 2: Title & Subtitle merged or separate
  const reportTitleRow = `<Row ss:Height="25"><Cell ss:StyleID="Title"><Data ss:Type="String">${title.toUpperCase()}</Data></Cell></Row>`;
  const subtitleRow = subtitle ? `<Row ss:Height="18"><Cell ss:StyleID="Subtitle"><Data ss:Type="String">${subtitle}</Data></Cell></Row>` : "";
  const infoRow = `<Row ss:Height="15"><Cell ss:StyleID="Subtitle"><Data ss:Type="String">Dicetak pada: ${new Date().toLocaleString('id-ID')}</Data></Cell></Row>`;

  // Row 5: Table Header (Freeze Pane starts after this)
  const tableHeadRow = `<Row ss:Height="30">
    ${columns.map(col => `<Cell ss:StyleID="Header"><Data ss:Type="String">${col.header}</Data></Cell>`).join("")}
  </Row>`;

  // Data Rows
  const tableBodyRows = data.map((row, idx) => {
    const isAlt = idx % 2 !== 0;
    return `<Row>
      ${columns.map(col => {
      const val = row[col.key];
      const isNum = typeof val === 'number';
      // Center alignment for generic numeric columns or 'key' specific
      const shouldCenter = col.key === 'no' || isNum;
      const styleId = shouldCenter ? (isAlt ? 'DataCenterAlt' : 'DataCenter') : (isAlt ? 'DataAlt' : 'Data');
      return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${isNum ? 'Number' : 'String'}">${val ?? "-"}</Data></Cell>`;
    }).join("")}
    </Row>`;
  }).join("");

  // Worksheet Options: Freeze Panes, AutoFilter, Footer
  const worksheetOptions = `
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <PageSetup>
        <Layout x:Orientation="${options.orientation === 'landscape' ? 'Landscape' : 'Portrait'}"/>
        <Header x:Margin="0.3"/>
        <Footer x:Margin="0.3" x:Data="Official document – T-Absensi | Page &amp;P of &amp;N"/>
        <PageMargins x:Bottom="0.75" x:Left="0.7" x:Right="0.7" x:Top="0.75"/>
      </PageSetup>
      <Print>
        <ValidPrinterInfo/>
        <PaperSizeIndex>9</PaperSizeIndex> <!-- A4 -->
        <HorizontalResolution>600</HorizontalResolution>
        <VerticalResolution>600</VerticalResolution>
      </Print>
      <Selected/>
      <Panes>
        <Pane>
          <Number>3</Number> <!-- Split Horizontal -->
          <ActiveRow>5</ActiveRow> <!-- After header rows -->
          <RangeSelection>R6C1</RangeSelection>
        </Pane>
      </Panes>
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>5</SplitHorizontal>
      <TopRowBottomPane>5</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
    <AutoFilter x:Range="R5C1:R5C${columns.length}" xmlns="urn:schemas-microsoft-com:office:excel"/>
  `;

  // Combine
  // Note: We inserted 4 rows of header info (Company, Title, Subtitle, Info) -> Table Header is Row 5.
  // So SplitHorizontal = 5.

  const content = xmlHeader + colWidths +
    companyRow + reportTitleRow + subtitleRow + infoRow +
    tableHeadRow + tableBodyRows +
    `</Table>${worksheetOptions}</Worksheet></Workbook>`;

  const blob = new Blob([content], { type: "application/vnd.ms-excel" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.xls`; // Keeping xls for XML format compatibility
  link.click();
  URL.revokeObjectURL(link.href);
};