import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/logo.png";

// ============== TYPES ==============
interface EmployeeAttendance {
    name: string;
    department: string;
    present: number;
    absent: number;
    leave: number;
    late: number;
    absentDates: string[];
    lateDates: string[];
    leaveDates: string[];
    remarks: string;
    dailyStatus: Record<string, string>; // Key: "YYYY-MM-DD", Value: Status Code (H, S, I, A, T, L)
}

interface AttendanceReportData {
    period: string;
    periodStart: string;
    periodEnd: string;
    totalEmployees: number;
    totalPresent: number;
    totalAbsent: number;
    totalLeave: number;
    totalLate: number;
    employees: EmployeeAttendance[];
    leaveRequests: {
        name: string;
        department: string;
        type: string;
        startDate: string;
        endDate: string;
        days: number;
        status: string;
    }[];
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

// Format dates: "3, 7, 12 Januari 2026"
const formatDatesDisplay = (dates: string[], period: string): string => {
    if (dates.length === 0) return "—";
    const monthYear = new Date(period + "-01");
    const monthName = monthYear.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    const days = dates.map(d => new Date(d).getDate()).sort((a, b) => a - b);
    if (days.length <= 5) return days.join(", ") + " " + monthName;
    return days.slice(0, 4).join(", ") + ` (+${days.length - 4}) ${monthName}`;
};

// ============== MULTI-SHEET EXCEL EXPORT ==============
export const exportAttendanceExcel = (data: AttendanceReportData, filename: string) => {
    const printDate = new Date().toLocaleString("id-ID");

    // Excel XML Styles
    const styles = `
    <Styles>
        <Style ss:ID="Title"><Font ss:FontName="Arial" ss:Bold="1" ss:Size="14" ss:Color="#1E40AF"/><Alignment ss:Horizontal="Left" ss:Vertical="Center"/></Style>
        <Style ss:ID="Subtitle"><Font ss:FontName="Arial" ss:Size="10" ss:Color="#4A5568"/></Style>
        <Style ss:ID="Header"><Font ss:FontName="Arial" ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF"/><Interior ss:Color="#1E40AF" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A0AEC0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A0AEC0"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A0AEC0"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A0AEC0"/></Borders></Style>
        <Style ss:ID="Data"><Font ss:FontName="Arial" ss:Size="9"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="0.5" ss:Color="#E2E8F0"/></Borders><Alignment ss:Vertical="Center"/></Style>
        <Style ss:ID="DataAlt"><Font ss:FontName="Arial" ss:Size="9"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="0.5" ss:Color="#E2E8F0"/></Borders><Alignment ss:Vertical="Center"/></Style>
        <Style ss:ID="DataCenter"><Font ss:FontName="Arial" ss:Size="9"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="0.5" ss:Color="#E2E8F0"/></Borders></Style>
        <Style ss:ID="DataCenterAlt"><Font ss:FontName="Arial" ss:Size="9"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="0.5" ss:Color="#E2E8F0"/></Borders></Style>
        <Style ss:ID="SectionHeader"><Font ss:FontName="Arial" ss:Bold="1" ss:Size="11" ss:Color="#1E40AF"/><Alignment ss:Vertical="Center"/></Style>
        <Style ss:ID="Good"><Font ss:FontName="Arial" ss:Size="9" ss:Color="#047857"/><Alignment ss:Horizontal="Center"/></Style>
        <Style ss:ID="Warning"><Font ss:FontName="Arial" ss:Size="9" ss:Color="#D97706"/><Alignment ss:Horizontal="Center"/></Style>
        <Style ss:ID="Bad"><Font ss:FontName="Arial" ss:Size="9" ss:Color="#DC2626"/><Alignment ss:Horizontal="Center"/></Style>
        <Style ss:ID="SignatureLabel"><Font ss:FontName="Arial" ss:Bold="1" ss:Size="10"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
    </Styles>`;

    // ===== SHEET 1: Ringkasan Kehadiran =====
    const sheet1 = `
    <Worksheet ss:Name="Ringkasan Kehadiran">
        <Table>
            <Column ss:Width="150"/><Column ss:Width="120"/><Column ss:Width="60"/><Column ss:Width="70"/><Column ss:Width="50"/><Column ss:Width="60"/><Column ss:Width="150"/>
            <Row ss:Height="22"><Cell ss:StyleID="Title"><Data ss:Type="String">${COMPANY_NAME}</Data></Cell></Row>
            <Row ss:Height="20"><Cell ss:StyleID="Title"><Data ss:Type="String">LAPORAN KEHADIRAN KARYAWAN</Data></Cell></Row>
            <Row ss:Height="16"><Cell ss:StyleID="Subtitle"><Data ss:Type="String">Periode: ${data.period}</Data></Cell></Row>
            <Row ss:Height="16"><Cell ss:StyleID="Subtitle"><Data ss:Type="String">Dicetak: ${printDate}</Data></Cell></Row>
            <Row ss:Height="10"></Row>
            <Row ss:Height="16"><Cell ss:StyleID="SectionHeader"><Data ss:Type="String">STATISTIK KEHADIRAN</Data></Cell></Row>
            <Row><Cell ss:StyleID="Data"><Data ss:Type="String">Total Karyawan</Data></Cell><Cell ss:StyleID="DataCenter"><Data ss:Type="Number">${data.totalEmployees}</Data></Cell></Row>
            <Row><Cell ss:StyleID="Data"><Data ss:Type="String">Total Hadir</Data></Cell><Cell ss:StyleID="Good"><Data ss:Type="Number">${data.totalPresent}</Data></Cell></Row>
            <Row><Cell ss:StyleID="Data"><Data ss:Type="String">Total Tidak Hadir</Data></Cell><Cell ss:StyleID="Bad"><Data ss:Type="Number">${data.totalAbsent}</Data></Cell></Row>
            <Row><Cell ss:StyleID="Data"><Data ss:Type="String">Total Cuti</Data></Cell><Cell ss:StyleID="DataCenter"><Data ss:Type="Number">${data.totalLeave}</Data></Cell></Row>
            <Row><Cell ss:StyleID="Data"><Data ss:Type="String">Total Terlambat</Data></Cell><Cell ss:StyleID="Warning"><Data ss:Type="Number">${data.totalLate}</Data></Cell></Row>
            <Row ss:Height="15"></Row>
            <Row ss:Height="16"><Cell ss:StyleID="SectionHeader"><Data ss:Type="String">DATA KARYAWAN</Data></Cell></Row>
            <Row ss:Height="28">
                <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Karyawan</Data></Cell>
                <Cell ss:StyleID="Header"><Data ss:Type="String">Departemen</Data></Cell>
                <Cell ss:StyleID="Header"><Data ss:Type="String">Hadir</Data></Cell>
                <Cell ss:StyleID="Header"><Data ss:Type="String">Tidak Hadir</Data></Cell>
                <Cell ss:StyleID="Header"><Data ss:Type="String">Cuti</Data></Cell>
                <Cell ss:StyleID="Header"><Data ss:Type="String">Terlambat</Data></Cell>
                <Cell ss:StyleID="Header"><Data ss:Type="String">Keterangan</Data></Cell>
            </Row>
            ${data.employees.map((e, i) => `
            <Row>
                <Cell ss:StyleID="${i % 2 ? 'DataAlt' : 'Data'}"><Data ss:Type="String">${e.name}</Data></Cell>
                <Cell ss:StyleID="${i % 2 ? 'DataAlt' : 'Data'}"><Data ss:Type="String">${e.department}</Data></Cell>
                <Cell ss:StyleID="Good"><Data ss:Type="Number">${e.present}</Data></Cell>
                <Cell ss:StyleID="${e.absent > 0 ? 'Bad' : 'DataCenter'}"><Data ss:Type="Number">${e.absent}</Data></Cell>
                <Cell ss:StyleID="DataCenter"><Data ss:Type="Number">${e.leave}</Data></Cell>
                <Cell ss:StyleID="${e.late > 0 ? 'Warning' : 'DataCenter'}"><Data ss:Type="Number">${e.late}</Data></Cell>
                <Cell ss:StyleID="${i % 2 ? 'DataAlt' : 'Data'}"><Data ss:Type="String">${e.remarks || '-'}</Data></Cell>
            </Row>`).join('')}
            
            <Row ss:Height="30"></Row>
            <Row>
                <Cell ss:Index="2" ss:StyleID="SignatureLabel"><Data ss:Type="String">Dibuat Oleh,</Data></Cell>
                <Cell ss:Index="6" ss:StyleID="SignatureLabel"><Data ss:Type="String">Disetujui Oleh,</Data></Cell>
            </Row>
            <Row ss:Height="50"></Row>
            <Row>
                <Cell ss:Index="2" ss:StyleID="SignatureLabel"><Data ss:Type="String">( HR Manager )</Data></Cell>
                <Cell ss:Index="6" ss:StyleID="SignatureLabel"><Data ss:Type="String">( Direktur Utama )</Data></Cell>
            </Row>
        </Table>
    </Worksheet>`;

    // ===== SHEET 2: Detail Kehadiran (Matrix View) =====
    // Generate Header Row for Days 1-31
    const daysInMonth = new Date(new Date(data.periodEnd).getFullYear(), new Date(data.periodEnd).getMonth() + 1, 0).getDate();
    let headerRow = `<Row ss:Height="22">
        <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Karyawan</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Departemen</Data></Cell>`;

    // Add columns for each day
    for (let d = 1; d <= daysInMonth; d++) {
        headerRow += `<Cell ss:StyleID="Header" ss:Width="25"><Data ss:Type="String">${d}</Data></Cell>`;
    }
    headerRow += `</Row>`;

    // Generate Legend
    const legendRow = `<Row ss:Height="16"><Cell ss:MergeAcross="${daysInMonth + 1}" ss:StyleID="Subtitle"><Data ss:Type="String">Keterangan: H=Hadir, T=Terlambat, A=Alpha, S=Sakit, I=Izin, C=Cuti, L=Libur</Data></Cell></Row>`;

    const sheet2 = `
    <Worksheet ss:Name="Detail Kehadiran (Matrix)">
        <Table>
            <Column ss:Width="150"/><Column ss:Width="120"/>
            ${Array(daysInMonth).fill('<Column ss:Width="25"/>').join('')}
            <Row ss:Height="22"><Cell ss:StyleID="Title"><Data ss:Type="String">DETAIL KEHADIRAN (MATRIX) - ${data.period.toUpperCase()}</Data></Cell></Row>
            ${legendRow}
            <Row ss:Height="10"></Row>
            ${headerRow}
            ${data.employees.map((e, i) => {
        let row = `<Row>`;
        row += `<Cell ss:StyleID="${i % 2 ? 'DataAlt' : 'Data'}"><Data ss:Type="String">${e.name}</Data></Cell>`;
        row += `<Cell ss:StyleID="${i % 2 ? 'DataAlt' : 'Data'}"><Data ss:Type="String">${e.department}</Data></Cell>`;

        // Cells for days
        for (let d = 1; d <= daysInMonth; d++) {
            // Construct Date Key YYYY-MM-DD
            const current = new Date(data.periodStart);
            current.setDate(d);
            const dateKey = current.toISOString().split('T')[0];
            const status = e.dailyStatus[dateKey] || '-';

            let style = "DataCenter";
            if (status === 'H') style = "Good";
            if (status === 'T') style = "Warning";
            if (status === 'A') style = "Bad";

            // Allow alternating background
            if (i % 2 && style === "DataCenter") style = "DataCenterAlt";

            row += `<Cell ss:StyleID="${style}"><Data ss:Type="String">${status}</Data></Cell>`;
        }
        row += `</Row>`;
        return row;
    }).join('')}
        </Table>
    </Worksheet>`;

    // ===== SHEET 3: Ringkasan Cuti =====
    const sheet3 = `
    <Worksheet ss:Name="Ringkasan Cuti">
        <Table>
            <Column ss:Width="150"/><Column ss:Width="100"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="50"/><Column ss:Width="80"/>
            <Row ss:Height="22"><Cell ss:StyleID="Title"><Data ss:Type="String">LAPORAN CUTI KARYAWAN - ${data.period.toUpperCase()}</Data></Cell></Row>
            <Row ss:Height="10"></Row>
            <Row ss:Height="28">
                <Cell ss:StyleID="Header"><Data ss:Type="String">Nama Karyawan</Data></Cell>
                <Cell ss:StyleID="Header"><Data ss:Type="String">Departemen</Data></Cell>
                <Cell ss:StyleID="Header"><Data ss:Type="String">Jenis Cuti</Data></Cell>
                <Cell ss:StyleID="Header"><Data ss:Type="String">Tanggal Mulai</Data></Cell>
                <Cell ss:StyleID="Header"><Data ss:Type="String">Tanggal Selesai</Data></Cell>
                <Cell ss:StyleID="Header"><Data ss:Type="String">Hari</Data></Cell>
                <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
            </Row>
            ${data.leaveRequests.length > 0 ? data.leaveRequests.map((l, i) => `
            <Row>
                <Cell ss:StyleID="${i % 2 ? 'DataAlt' : 'Data'}"><Data ss:Type="String">${l.name}</Data></Cell>
                <Cell ss:StyleID="${i % 2 ? 'DataAlt' : 'Data'}"><Data ss:Type="String">${l.department}</Data></Cell>
                <Cell ss:StyleID="${i % 2 ? 'DataAlt' : 'Data'}"><Data ss:Type="String">${l.type}</Data></Cell>
                <Cell ss:StyleID="${i % 2 ? 'DataCenterAlt' : 'DataCenter'}"><Data ss:Type="String">${l.startDate}</Data></Cell>
                <Cell ss:StyleID="${i % 2 ? 'DataCenterAlt' : 'DataCenter'}"><Data ss:Type="String">${l.endDate}</Data></Cell>
                <Cell ss:StyleID="${i % 2 ? 'DataCenterAlt' : 'DataCenter'}"><Data ss:Type="Number">${l.days}</Data></Cell>
                <Cell ss:StyleID="${l.status === 'Disetujui' ? 'Good' : l.status === 'Ditolak' ? 'Bad' : 'Warning'}"><Data ss:Type="String">${l.status}</Data></Cell>
            </Row>`).join('') : '<Row><Cell ss:StyleID="Data"><Data ss:Type="String">Tidak ada data cuti</Data></Cell></Row>'}
        </Table>
    </Worksheet>`;

    // ===== SHEET 4: Informasi Laporan =====
    const sheet4 = `
    <Worksheet ss:Name="Informasi Laporan">
        <Table>
            <Column ss:Width="180"/><Column ss:Width="250"/>
            <Row ss:Height="22"><Cell ss:StyleID="Title"><Data ss:Type="String">INFORMASI LAPORAN</Data></Cell></Row>
            <Row ss:Height="10"></Row>
            <Row><Cell ss:StyleID="Data"><Data ss:Type="String">Nama Perusahaan</Data></Cell><Cell ss:StyleID="Data"><Data ss:Type="String">${COMPANY_NAME}</Data></Cell></Row>
            <Row><Cell ss:StyleID="DataAlt"><Data ss:Type="String">Divisi</Data></Cell><Cell ss:StyleID="DataAlt"><Data ss:Type="String">${COMPANY_DIV}</Data></Cell></Row>
            <Row><Cell ss:StyleID="Data"><Data ss:Type="String">Periode Laporan</Data></Cell><Cell ss:StyleID="Data"><Data ss:Type="String">${data.period}</Data></Cell></Row>
            <Row><Cell ss:StyleID="DataAlt"><Data ss:Type="String">Tanggal Cetak</Data></Cell><Cell ss:StyleID="DataAlt"><Data ss:Type="String">${printDate}</Data></Cell></Row>
            <Row><Cell ss:StyleID="Data"><Data ss:Type="String">Jumlah Karyawan</Data></Cell><Cell ss:StyleID="Data"><Data ss:Type="Number">${data.totalEmployees}</Data></Cell></Row>
            <Row ss:Height="20"></Row>
            <Row><Cell ss:StyleID="SectionHeader"><Data ss:Type="String">CATATAN</Data></Cell></Row>
            <Row><Cell ss:StyleID="Subtitle" ss:MergeAcross="1"><Data ss:Type="String">• Data cuti diambil otomatis dari pengajuan cuti yang telah disetujui</Data></Cell></Row>
            <Row><Cell ss:StyleID="Subtitle" ss:MergeAcross="1"><Data ss:Type="String">• Hari kerja dihitung berdasarkan hari Senin–Jumat</Data></Cell></Row>
            <Row><Cell ss:StyleID="Subtitle" ss:MergeAcross="1"><Data ss:Type="String">• Laporan ini digenerate oleh T-Absensi System</Data></Cell></Row>
        </Table>
    </Worksheet>`;

    // Combine all sheets
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
    <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
        <Author>T-Absensi System</Author>
        <Title>Laporan Kehadiran - ${data.period}</Title>
        <Created>${new Date().toISOString()}</Created>
    </DocumentProperties>
    ${styles}
    ${sheet1}
    ${sheet2}
    ${sheet3}
    ${sheet4}
</Workbook>`;

    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
};

// ============== HR PDF EXPORT (Detailed) ==============
export const exportAttendanceHRPDF = async (data: AttendanceReportData, filename: string) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const printDate = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    // Load logo
    let logoImg: HTMLImageElement | null = null;
    try { logoImg = await loadImage(logoUrl); } catch (e) { console.warn("Logo not loaded"); }

    // === HEADER ===
    if (logoImg) {
        doc.addImage(logoImg, "PNG", margin, 8, 18, 18);
        doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 64, 175);
        doc.text(COMPANY_NAME, margin + 22, 14);
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
        doc.text(COMPANY_DIV, margin + 22, 19);
    }

    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
    doc.text("LAPORAN KEHADIRAN KARYAWAN", pageWidth / 2, 32, { align: "center" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${data.period}`, pageWidth / 2, 38, { align: "center" });
    doc.setFontSize(8); doc.setTextColor(100);
    doc.text(`Dicetak: ${printDate}`, pageWidth / 2, 43, { align: "center" });
    doc.setDrawColor(200); doc.line(margin, 46, pageWidth - margin, 46);

    // === SUMMARY STATS ===
    doc.setFontSize(9); doc.setTextColor(0);
    const statsY = 52;
    doc.text(`Total Karyawan: ${data.totalEmployees}`, margin, statsY);
    doc.text(`Hadir: ${data.totalPresent}`, margin + 50, statsY);
    doc.setTextColor(220, 38, 38); doc.text(`Tidak Hadir: ${data.totalAbsent}`, margin + 90, statsY);
    doc.setTextColor(217, 119, 6); doc.text(`Terlambat: ${data.totalLate}`, margin + 140, statsY);
    doc.setTextColor(0); doc.text(`Cuti: ${data.totalLeave}`, margin + 185, statsY);

    // === MAIN TABLE ===
    const tableData = data.employees.map((e, i) => [
        i + 1,
        e.name,
        e.department,
        e.present,
        e.absent,
        e.leave,
        e.late,
        e.absentDates.length > 0 || e.lateDates.length > 0 || e.leaveDates.length > 0
            ? [
                e.absentDates.length > 0 ? `Absen: ${formatDatesDisplay(e.absentDates, data.periodStart)}` : '',
                e.leaveDates.length > 0 ? `Cuti: ${formatDatesDisplay(e.leaveDates, data.periodStart)}` : '',
                e.lateDates.length > 0 ? `Telat: ${formatDatesDisplay(e.lateDates, data.periodStart)}` : '',
            ].filter(Boolean).join('\n')
            : '—',
        e.remarks || '-'
    ]);

    autoTable(doc, {
        head: [['No', 'Nama Karyawan', 'Departemen', 'Hadir', 'Tidak Hadir', 'Cuti', 'Terlambat', 'Detail Kehadiran (Tanggal)', 'Keterangan']],
        body: tableData,
        startY: 58,
        theme: "grid",
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 8, cellPadding: 2 },
        bodyStyles: { fontSize: 7, cellPadding: 2, valign: "top" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            3: { halign: "center", cellWidth: 15 },
            4: { halign: "center", cellWidth: 20 },
            5: { halign: "center", cellWidth: 12 },
            6: { halign: "center", cellWidth: 18 },
            7: { cellWidth: 70 },
            8: { cellWidth: 40 },
        },
        margin: { left: margin, right: margin, bottom: 18 },
        didDrawPage: (d) => {
            doc.setFontSize(7); doc.setTextColor(100);
            doc.text("T-Absensi System", margin, pageHeight - 8);
            doc.text(`Halaman ${d.pageNumber}`, pageWidth - margin, pageHeight - 8, { align: "right" });
        }
    });

    // === SIGNATURES ===
    let finalY = (doc as any).lastAutoTable.finalY + 15 || 65;
    if (finalY > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        finalY = 25;
    }

    doc.setFontSize(9); doc.setTextColor(0); doc.setFont("helvetica", "bold");

    // Left Signature
    doc.text("Dibuat Oleh,", margin + 20, finalY);
    doc.line(margin + 15, finalY + 20, margin + 55, finalY + 20);
    doc.text("HR Manager", margin + 25, finalY + 25);

    // Right Signature
    const rightSigX = pageWidth - margin - 50;
    doc.text("Disetujui Oleh,", rightSigX + 5, finalY);
    doc.line(rightSigX, finalY + 20, rightSigX + 40, finalY + 20);
    doc.text("Direktur Utama", rightSigX + 8, finalY + 25);

    // === APPENDIX: ATTENDANCE MATRIX PAGE ===
    doc.addPage();
    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
    doc.text("APPENDIX: MATRIKS KEHADIRAN HARIAN", pageWidth / 2, 20, { align: "center" });

    const daysInMonth = new Date(new Date(data.periodEnd).getFullYear(), new Date(data.periodEnd).getMonth() + 1, 0).getDate();

    // Matrix Table Data
    const matrixHead = [['Nama', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1))]];
    const matrixBody = data.employees.map(e => {
        const row = [e.name];
        for (let d = 1; d <= daysInMonth; d++) {
            // Construct Date Key YYYY-MM-DD
            const current = new Date(data.periodStart);
            current.setDate(d);
            const dateKey = current.toISOString().split('T')[0];
            row.push(e.dailyStatus[dateKey] || '-');
        }
        return row;
    });

    autoTable(doc, {
        head: matrixHead,
        body: matrixBody,
        startY: 25,
        theme: "grid",
        styles: { fontSize: 6, cellPadding: 1, halign: 'center' },
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 30, halign: 'left' } }, // Name column wider
        margin: { top: 25, left: 10, right: 10 },
        tableWidth: 'auto'
    });

    doc.setFontSize(8);
    doc.text("Ket: H=Hadir, T=Terlambat, A=Alpha, S=Sakit, I=Izin, C=Cuti, L=Libur", 10, doc.internal.pageSize.getHeight() - 10);

    doc.save(`${filename}.pdf`);
};

// ============== MANAGEMENT PDF EXPORT (Executive Summary) ==============
export const exportAttendanceManagementPDF = async (data: AttendanceReportData, filename: string) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const printDate = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    // Load logo
    let logoImg: HTMLImageElement | null = null;
    try { logoImg = await loadImage(logoUrl); } catch (e) { console.warn("Logo not loaded"); }

    // === HEADER ===
    if (logoImg) {
        doc.addImage(logoImg, "PNG", margin, 15, 22, 22);
    }
    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 64, 175);
    doc.text(COMPANY_NAME, pageWidth / 2, 22, { align: "center" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
    doc.text(COMPANY_DIV, pageWidth / 2, 28, { align: "center" });

    doc.setDrawColor(30, 64, 175); doc.setLineWidth(0.8);
    doc.line(margin, 35, pageWidth - margin, 35);

    // === TITLE ===
    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
    doc.text("RINGKASAN EKSEKUTIF KEHADIRAN", pageWidth / 2, 48, { align: "center" });
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${data.period}`, pageWidth / 2, 55, { align: "center" });

    // === KEY METRICS BOX ===
    const boxY = 65;
    const boxWidth = (pageWidth - margin * 2 - 15) / 4;

    const metrics = [
        { label: "Karyawan", value: data.totalEmployees, color: [51, 65, 85] },
        { label: "Hadir", value: data.totalPresent, color: [4, 120, 87] },
        { label: "Tidak Hadir", value: data.totalAbsent, color: [220, 38, 38] },
        { label: "Terlambat", value: data.totalLate, color: [217, 119, 6] },
    ];

    metrics.forEach((m, i) => {
        const x = margin + i * (boxWidth + 5);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, boxY, boxWidth, 28, 3, 3, "F");
        doc.setFontSize(22); doc.setFont("helvetica", "bold");
        doc.setTextColor(m.color[0], m.color[1], m.color[2]);
        doc.text(String(m.value), x + boxWidth / 2, boxY + 14, { align: "center" });
        doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
        doc.text(m.label, x + boxWidth / 2, boxY + 22, { align: "center" });
    });

    // === INSIGHTS ===
    const insightY = 105;
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 64, 175);
    doc.text("INSIGHT & CATATAN", margin, insightY);
    doc.setDrawColor(200); doc.line(margin, insightY + 2, pageWidth - margin, insightY + 2);

    const attendanceRate = data.totalEmployees > 0 ? Math.round((data.totalPresent / (data.totalPresent + data.totalAbsent)) * 100) : 0;
    const highAbsentees = data.employees.filter(e => e.absent >= 3).length;
    const frequentLate = data.employees.filter(e => e.late >= 5).length;

    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(50);
    let y = insightY + 12;

    const insights = [
        `• Tingkat kehadiran periode ini: ${attendanceRate}%`,
        `• Total cuti yang diambil: ${data.totalLeave} hari`,
        highAbsentees > 0 ? `• Perlu perhatian: ${highAbsentees} karyawan dengan ketidakhadiran ≥3 hari` : "• Semua karyawan memiliki kehadiran baik",
        frequentLate > 0 ? `• Karyawan sering terlambat: ${frequentLate} orang` : "• Tidak ada karyawan dengan keterlambatan berlebih",
    ];

    insights.forEach(text => {
        doc.text(text, margin, y);
        y += 8;
    });

    // === TOP ABSENTEES (if any) ===
    const topAbsentees = data.employees.filter(e => e.absent > 0).sort((a, b) => b.absent - a.absent).slice(0, 5);
    if (topAbsentees.length > 0) {
        y += 8;
        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 64, 175);
        doc.text("KARYAWAN DENGAN KETIDAKHADIRAN TERTINGGI", margin, y);
        doc.setDrawColor(200); doc.line(margin, y + 2, pageWidth - margin, y + 2);
        y += 10;

        autoTable(doc, {
            head: [["Nama", "Departemen", "Tidak Hadir", "Tanggal"]],
            body: topAbsentees.map(e => [e.name, e.department, e.absent, formatDatesDisplay(e.absentDates, data.periodStart)]),
            startY: y,
            theme: "plain",
            headStyles: { fillColor: [241, 245, 249], textColor: 50, fontStyle: "bold", fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            columnStyles: { 2: { halign: "center" } },
            margin: { left: margin, right: margin },
        });
    }

    // === FOOTER (Signatures) ===
    const signatureY = doc.internal.pageSize.getHeight() - 50;

    doc.setFontSize(10); doc.setTextColor(0);
    // Left Signature (HR Manager)
    doc.text("Dibuat Oleh,", margin + 10, signatureY);
    doc.line(margin, signatureY + 25, margin + 40, signatureY + 25);
    doc.text("HR Manager", margin + 10, signatureY + 30);

    // Right Signature (Director)
    doc.text("Disetujui Oleh,", pageWidth - margin - 35, signatureY);
    doc.line(pageWidth - margin - 45, signatureY + 25, pageWidth - margin - 5, signatureY + 25);
    doc.text("Direktur Utama", pageWidth - margin - 32, signatureY + 30);

    // === PAGE FOOTER ===
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setDrawColor(200); doc.line(margin, footerY, pageWidth - margin, footerY);
    doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`Dokumen ini digenerate otomatis oleh T-Absensi System`, margin, footerY + 6);
    doc.text(`Dicetak: ${printDate}`, pageWidth - margin, footerY + 6, { align: "right" });

    doc.save(`${filename}.pdf`);
};

export type { AttendanceReportData, EmployeeAttendance };
