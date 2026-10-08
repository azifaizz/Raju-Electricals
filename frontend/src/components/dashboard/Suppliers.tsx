import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Trash2, PlusCircle, X, Upload, CreditCard, Loader2, Save } from 'lucide-react';
import { vendorService, Vendor } from '@/lib/api';
import { useGlobalData } from '@/context/GlobalDataContext';
import Papa from 'papaparse';
import { parseExcelFile } from '@/utils/excelParser';
import SupplierCreditPanel from './SupplierCreditPanel';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useConfirm } from '@/hooks/useConfirm';
import { useAuth } from '@/context/AuthContext';

const Suppliers = () => {
  const { user } = useAuth();
  const isCashier = user?.role?.toLowerCase() === 'cashier';
  const { vendors: suppliers, loading: globalLoading, refreshVendors: refreshSuppliers, mutateVendors, isSyncing } = useGlobalData();
  const { confirm: confirmAction, ConfirmationDialog } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Vendor | null>(null);
  const [isCreditPanelOpen, setIsCreditPanelOpen] = useState(false);
  const [selectedSupplierForCredit, setSelectedSupplierForCredit] = useState<Vendor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false); // For CSV/local actions
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; contact: string; gst: string; address: string; state: string; customId: string; vendorInvoice: string }>({
    name: '', contact: '', gst: '', address: '', state: '', customId: '', vendorInvoice: ''
  });

  const handleEditClick = (s: Vendor) => {
    setEditingId(s.id);
    setEditForm({
      name: s.name,
      contact: s.phone || '',
      gst: s.gstin || '',
      address: s.address || '',
      state: s.state || '',
      customId: s.id || '',
      vendorInvoice: s.vendorInvoice || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', contact: '', gst: '', address: '', state: '', customId: '', vendorInvoice: '' });
  };

  const handleSaveSupplier = async (supplier: Omit<Vendor, 'id'> & { id?: string; newId?: string; contact?: string; gst?: string; }) => {
    if (!supplier.id) {
      const isDuplicate = suppliers.some(
        s => s.name.trim().toLowerCase() === supplier.name.trim().toLowerCase()
      );
      if (isDuplicate) {
        toast.error(`Supplier "${supplier.name}" already exists.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        id: supplier.newId || supplier.id, // Try to set ID in body if allowed
        name: supplier.name,
        phone: supplier.contact,
        address: supplier.address,
        state: supplier.state,
        gstNo: supplier.gst,
        vendorInvoice: supplier.vendorInvoice,
      };

      if (supplier.id) {
        await vendorService.patch(`/vendors/update/${supplier.id}`, payload);
        toast.success('Supplier updated!');
      } else {
        await vendorService.post('/vendors/add', payload);
        toast.success('Supplier added!');
      }
      await refreshSuppliers();
      handleCloseModal();
      setEditingId(null); // Clear inline edit if applicable
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveInline = () => {
    if (!editingId) return;
    // Pass customId as id. Note: 'id' in handleSaveSupplier is used for the URL.
    handleSaveSupplier({ ...editForm, id: editingId, newId: editForm.customId } as any);
  };

  const handleDeleteSupplier = (id: string) => {
    confirmAction("Are you sure you want to delete this supplier?", async () => {
      setDeletingId(id);
      try {
        await vendorService.delete(`/vendors/delete/${id}`);
        mutateVendors(prev => prev.filter(v => v.id !== id));
        toast.success('Deleted!');
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Delete failed.');
      } finally {
        setDeletingId(null);
      }
    }, "Delete Supplier");
  };

  // CSV Upload
  const handleUploadClick = () => fileInputRef.current?.click();

  const processRows = async (rows: any[]) => {
    if (rows.length === 0) {
      toast.error('File is empty.');
      setLoading(false);
      return;
    }

    let success = 0, failed = 0;

    for (const row of rows) {
      const payload = {
        name: row.name?.trim() || row.Name?.trim() || row['Supplier Name']?.trim(),
        phone: (row.contact || row.phone || row.Phone || row.Contact || '').toString().trim(),
        address: (row.address || row.Address || '').trim(),
        state: (row.state || row.State || '').trim(),
        gstNo: (row.gst || row.gstin || row.GST || row.GSTIN || '').trim(),
      };

      if (!payload.name) {
        failed++;
        continue;
      }

      try {
        await vendorService.post('/vendors/add', payload);
        success++;
      } catch (err) {
        failed++;
      }
    }

    toast.success(`Import complete: ${success} added, ${failed} failed.`);
    await refreshSuppliers();
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processRows(results.data as any[]),
        error: (err) => {
          toast.error('CSV Parse error: ' + err.message);
          setLoading(false);
        }
      });
    } else if (file.name.match(/\.(xlsx|xls)$/)) {
      try {
        const data = await parseExcelFile(file);
        processRows(data);
      } catch (err: any) {
        toast.error('Excel Parse error: ' + err.message);
        setLoading(false);
      }
    } else {
      toast.error("Unsupported file type");
      setLoading(false);
    }
  };

  const handleOpenModal = (s: Vendor | null) => {
    setEditingSupplier(s); // Only used for Adding now, s will be null
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const handleOpenCredit = (s: Vendor) => {
    setSelectedSupplierForCredit(s);
    setIsCreditPanelOpen(true);
  };

  const filteredSuppliers = suppliers.filter(s =>
    (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.id && s.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.phone && s.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-6 p-6">
      <ConfirmationDialog />
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-800">Supplier Management</h1>
          <SyncIndicator isSyncing={isSyncing} />
        </div>
        {!isCashier && (
          <div className="flex gap-4">
            <button onClick={handleUploadClick} className="px-5 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2">
              <Upload size={20} /> Upload Excel
            </button>
            <button onClick={() => handleOpenModal(null)} className="px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2">
              <PlusCircle size={20} /> Add Supplier
            </button>
          </div>
        )}
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} />

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <input
          type="text"
          placeholder="Search by Name, ID, or Contact..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full md:w-1/3 p-2 border rounded"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {globalLoading && suppliers.length === 0 ? (
          <p className="p-6 text-gray-500">Loading...</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4">S.No</th>
                <th className="p-4">Supplier Name</th>
                <th className="p-4">Supplier ID</th>
                <th className="p-4">Contact No.</th>
                <th className="p-4">GST Number</th>
                <th className="p-4">Address</th>
                <th className="p-4">State</th>
                {!isCashier && <th className="p-4">Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((s, i) => {
                const isEditing = editingId === s.id;
                return (
                  <tr key={s.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">{i + 1}</td>

                    {isEditing ? (
                      <>
                        <td className="p-4"><input id={`edit-name-${s.id}`} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`edit-contact-${s.id}`)?.focus(); } }} className="border rounded p-1 w-full" autoFocus /></td>
                        <td className="p-4"><input value={editForm.customId} disabled className="border rounded p-1 w-full font-mono bg-gray-100 text-gray-500 cursor-not-allowed" placeholder="ID" /></td>
                        <td className="p-4"><input id={`edit-contact-${s.id}`} value={editForm.contact} onChange={e => setEditForm({ ...editForm, contact: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`edit-gst-${s.id}`)?.focus(); } }} className="border rounded p-1 w-full" /></td>
                        <td className="p-4"><input id={`edit-gst-${s.id}`} value={editForm.gst} onChange={e => setEditForm({ ...editForm, gst: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`edit-address-${s.id}`)?.focus(); } }} className="border rounded p-1 w-full" /></td>
                        <td className="p-4"><input id={`edit-address-${s.id}`} value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById(`edit-state-${s.id}`)?.focus(); } }} className="border rounded p-1 w-full" /></td>
                        <td className="p-4"><input id={`edit-state-${s.id}`} value={editForm.state} onChange={e => setEditForm({ ...editForm, state: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveInline(); } }} className="border rounded p-1 w-full" /></td>
                        <td className="p-4 flex gap-2">
                          <button onClick={handleSaveInline} disabled={isSaving} className="text-green-600 hover:text-green-800"><Save size={20} /></button>
                          <button onClick={handleCancelEdit} disabled={isSaving} className="text-red-500 hover:text-red-700"><X size={20} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 font-medium">{s.name}</td>
                        <td className="p-4 font-mono">{s.id}</td>
                        <td className="p-4">{s.phone}</td>
                        <td className="p-4">{s.gstin}</td>
                        <td className="p-4">{s.address}</td>
                        <td className="p-4">{s.state || "-"}</td>
                        {!isCashier && (
                          <td className="p-4">
                            <button onClick={() => handleEditClick(s)} className="text-blue-600 hover:text-blue-800"><Pencil size={18} /></button>
                            <button onClick={() => handleOpenCredit(s)} className="text-purple-600 hover:text-purple-800 ml-3" title="Manage Credit"><CreditCard size={18} /></button>
                            <button onClick={() => handleDeleteSupplier(s.id)} disabled={deletingId === s.id} className="text-red-600 hover:text-red-800 ml-3 disabled:opacity-50">{deletingId === s.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}</button>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <SupplierFormModal supplier={editingSupplier} onSave={handleSaveSupplier} onClose={handleCloseModal} isSaving={isSaving} />
      )}

      {isCreditPanelOpen && selectedSupplierForCredit && (
        <SupplierCreditPanel
          supplierId={selectedSupplierForCredit.id}
          supplierName={selectedSupplierForCredit.name}
          onClose={() => setIsCreditPanelOpen(false)}
        />
      )}
    </div>
  );
};

const SupplierFormModal = ({ supplier, onSave, onClose, isSaving }: { supplier: Vendor | null; onSave: any; onClose: () => void; isSaving?: boolean }) => {
  const [form, setForm] = useState({
    name: supplier?.name || '',
    contact: supplier?.phone || '',
    gst: supplier?.gstin || '',
    vendorInvoice: supplier?.vendorInvoice || '',
    address: supplier?.address || '',
    state: supplier?.state || '',
  });

  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const gstRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave({ ...form, id: supplier?.id });
  };

  const handleEnter = (e: React.KeyboardEvent, nextRef: React.RefObject<any>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{supplier ? 'Edit' : 'Add'} Supplier</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label>Supplier Name *</label>
            <input ref={nameRef} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} onKeyDown={(e) => handleEnter(e, contactRef)} className="w-full p-2 border rounded mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>Contact</label>
              <input ref={contactRef} type="text" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} onKeyDown={(e) => handleEnter(e, gstRef)} className="w-full p-2 border rounded mt-1" />
            </div>
            <div>
              <label>GST</label>
              <input ref={gstRef} value={form.gst} onChange={e => setForm({ ...form, gst: e.target.value })} onKeyDown={(e) => handleEnter(e, addressRef)} className="w-full p-2 border rounded mt-1" />
            </div>
          </div>

          <div>
            <label>Address</label>
            <input ref={addressRef} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} onKeyDown={(e) => handleEnter(e, stateRef)} className="w-full p-2 border rounded mt-1" />
          </div>
          <div>
            <label>State</label>
            <input ref={stateRef} value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }} className="w-full p-2 border rounded mt-1" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-5 py-2 bg-gray-200 rounded">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-5 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Suppliers;