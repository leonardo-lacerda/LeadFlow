import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

export const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'medium',
    }).format(new Date(date));
};

export function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
    if (rows.length === 0) return;

    const headers = Object.keys(rows[0]);
    const escapeValue = (value: string | number) =>
        `"${String(value).replace(/\"/g, '""')}"`;

    const csv = [
        headers.join(','),
        ...rows.map((row) => headers.map((h) => escapeValue(row[h] ?? '')).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
