import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

export interface AttendanceRecord {
    employeeName: string;
    department: string;
    date: string; // ISO date or formatted
    clockIn: string; // HH:mm
    clockOut: string | null; // HH:mm
    shift: string;
    status: 'Hadir' | 'Terlambat' | 'Alpha' | 'Cuti';
    totalWorkHours: number;
    totalLateMins: number;
    earlyLeaveMins: number;
    overtimeMins: number;
    device: string; // 'Web' | 'Android' | 'iOS'
}

export interface EmployeeSummary {
    employeeName: string;
    department: string;
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
    totalLeave: number;
    totalMonthlyWorkHours: number;
    totalMonthlyOvertimeMins: number;
}

export interface ExportAttendanceProps {
    month: string; // 'Januari 2024'
    companyName?: string;
    summaries: EmployeeSummary[];
    details: AttendanceRecord[];
}

/**
 * Profesional & Enterprise-level Excel Generator using exceljs
 */
export const generateAttendanceExcel = async ({
    month,
    companyName = 'PT. TALENTA TRAINCOM INDONESIA',
    summaries,
    details
}: ExportAttendanceProps) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'T-Absensi System';
    workbook.lastModifiedBy = 'T-Absensi System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ==========================================
    // SHEET 1: SUMMARY BULANAN PER KARYAWAN
    // ==========================================
    const summarySheet = workbook.addWorksheet('Summary Bulanan', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
    });

    // Report Headers
    summarySheet.mergeCells('A1', 'H1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = `${companyName} - Rekapitulasi Absensi Bulanan`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E40AF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    summarySheet.mergeCells('A2', 'H2');
    const periodCell = summarySheet.getCell('A2');
    periodCell.value = `Periode: ${month}`;
    periodCell.font = { name: 'Arial', size: 11, bold: true };
    periodCell.alignment = { vertical: 'middle', horizontal: 'left' };

    summarySheet.mergeCells('A3', 'H3');
    const printCell = summarySheet.getCell('A3');
    printCell.value = `Dicetak pada: ${format(new Date(), 'dd-MM-yyyy HH:mm')}`;
    printCell.font = { name: 'Arial', size: 10, italic: true };
    printCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Summary Table Headers
    const summaryHeaders = [
        'No',
        'Nama Karyawan',
        'Departemen',
        'Total Hadir',
        'Total Terlambat',
        'Total Alpha',
        'Total Cuti',
        'Total Jam Kerja',
        'Total Lembur (Jam)'
    ];

    summarySheet.getRow(5).values = summaryHeaders;
    summarySheet.getRow(5).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(5).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Header Style
    summaryHeaders.forEach((_, index) => {
        const cell = summarySheet.getCell(5, index + 1);
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E40AF' } // Corporate Blue
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Populate Summary Data
    summaries.forEach((summary, index) => {
        const row = summarySheet.addRow([
            index + 1,
            summary.employeeName,
            summary.department,
            summary.totalPresent,
            summary.totalLate,
            summary.totalAbsent,
            summary.totalLeave,
            Number(summary.totalMonthlyWorkHours.toFixed(2)),
            Number((summary.totalMonthlyOvertimeMins / 60).toFixed(2))
        ]);

        // Border & formatting for data rows
        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: 'hair' },
                left: { style: 'hair' },
                bottom: { style: 'hair' },
                right: { style: 'hair' }
            };
            cell.alignment = { vertical: 'middle', horizontal: [1, 4, 5, 6, 7, 8, 9].includes(colNumber) ? 'center' : 'left' };
            // Zebra striping
            if (index % 2 === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
        });
    });

    // Auto Column Width for Summary Sheet
    const summaryColWidths = [5, 25, 20, 15, 15, 15, 15, 20, 20];
    summarySheet.columns.forEach((col, idx) => {
        col.width = summaryColWidths[idx];
    });

    // ==========================================
    // SHEET 2: DETAIL HARIAN
    // ==========================================
    const detailSheet = workbook.addWorksheet('Detail Harian', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
    });

    // Report Headers (Detail)
    detailSheet.mergeCells('A1', 'L1');
    const dTitleCell = detailSheet.getCell('A1');
    dTitleCell.value = `${companyName} - Detail Absensi Harian Karyawan`;
    dTitleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E40AF' } };

    detailSheet.mergeCells('A2', 'L2');
    const dPeriodCell = detailSheet.getCell('A2');
    dPeriodCell.value = `Periode: ${month}`;
    dPeriodCell.font = { name: 'Arial', size: 11, bold: true };

    detailSheet.mergeCells('A3', 'L3');
    const dPrintCell = detailSheet.getCell('A3');
    dPrintCell.value = `Dicetak pada: ${format(new Date(), 'dd-MM-yyyy HH:mm')}`;
    dPrintCell.font = { name: 'Arial', size: 10, italic: true };

    // Detail Table Headers
    const detailHeaders = [
        'No',
        'Nama Karyawan',
        'Departemen',
        'Tanggal',
        'Jam Masuk',
        'Jam Keluar',
        'Shift',
        'Status',
        'Total Jam',
        'Terlambat (mnt)',
        'Pulang Cepat (mnt)',
        'Lembur (mnt)',
        'Device'
    ];

    detailSheet.getRow(5).values = detailHeaders;
    detailSheet.getRow(5).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    detailSheet.getRow(5).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    detailHeaders.forEach((_, index) => {
        const cell = detailSheet.getCell(5, index + 1);
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E40AF' }
        };
        cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
    });

    // Populate Detail Data
    details.forEach((detail, index) => {
        const row = detailSheet.addRow([
            index + 1,
            detail.employeeName,
            detail.department,
            detail.date, // Format should be DD-MM-YYYY string from caller
            detail.clockIn, // HH:mm string from caller
            detail.clockOut || '-', // HH:mm or '-'
            detail.shift,
            detail.status,
            Number(detail.totalWorkHours.toFixed(2)),
            detail.totalLateMins,
            detail.earlyLeaveMins,
            detail.overtimeMins,
            detail.device
        ]);

        // Border & Formatting
        row.eachCell((cell, colNumber) => {
            cell.border = { top: { style: 'hair' }, left: { style: 'hair' }, bottom: { style: 'hair' }, right: { style: 'hair' } };

            const centerCols = [1, 4, 5, 6, 8, 9, 10, 11, 12, 13];
            cell.alignment = { vertical: 'middle', horizontal: centerCols.includes(colNumber) ? 'center' : 'left' };

            // Status Colors
            if (colNumber === 8) { // Status column
                const status = cell.value?.toString();
                let fontColor = 'FF000000'; // black
                if (status === 'Terlambat') fontColor = 'FFD97706'; // Amber
                else if (status === 'Alpha') fontColor = 'FFDC2626'; // Red
                else if (status === 'Hadir') fontColor = 'FF059669'; // Green
                else if (status === 'Cuti') fontColor = 'FF2563EB'; // Blue

                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: fontColor } };
            } else {
                cell.font = { name: 'Arial', size: 10 };
            }

            if (index % 2 === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
        });
    });

    // Auto Column Width for Detail Sheet
    const detailColWidths = [5, 25, 20, 15, 15, 15, 15, 15, 15, 15, 20, 15, 15];
    detailSheet.columns.forEach((col, idx) => {
        col.width = detailColWidths[idx];
    });

    // Download File
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Rekap_Absensi_${month.replace(' ', '_')}.xlsx`);
};
