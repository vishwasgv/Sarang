import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Trash2, BedDouble } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { Card } from '@shared/ui/molecules/Card'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'

// Hotel/Lodge is a languageLock: 'en' business type (see
// industry-template.service.ts's SERVICE_TEMPLATE_TYPES) — every user of
// this screen always sees English regardless of the app's selected
// language, same as IndustrySettingsScreen.tsx's own TEMPLATES array
// already does for its per-vertical labels. Plain English strings here are
// therefore not a missing-i18n gap, just matching what actually renders.

interface HotelRoom {
  id: string
  roomNumber: string
  roomType: string
  floor: string | null
  maxOccupancy: number
  baseRate: number
  status: 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE' | 'OUT_OF_ORDER'
  amenities: string | null
  notes: string | null
  isActive: boolean
}

interface OccupancyReport {
  totalRooms: number
  occupied: number
  available: number
  cleaning: number
  maintenance: number
  occupancyPercent: number
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-success/10 text-success',
  OCCUPIED: 'bg-brand/10 text-brand',
  CLEANING: 'bg-warning/10 text-warning',
  MAINTENANCE: 'bg-slate-200 text-slate-500',
  OUT_OF_ORDER: 'bg-danger/10 text-danger',
}

const BLANK_FORM = { roomNumber: '', roomType: '', floor: '', maxOccupancy: '2', baseRate: '', amenities: '', notes: '' }

export function HotelRoomsScreen() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const canManage = hasPermission('hotel.manage')

  const [rooms, setRooms] = useState<HotelRoom[]>([])
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState<HotelRoom | null>(null)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HotelRoom | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [roomsRes, occRes] = await Promise.all([
        api.hotel.listRooms({ includeInactive: true }),
        api.hotel.occupancyReport(),
      ])
      if (roomsRes.success && roomsRes.data) setRooms((roomsRes.data as { rooms: HotelRoom[] }).rooms)
      else toastError('Error', roomsRes.error?.message ?? 'Could not load rooms.')
      if (occRes.success && occRes.data) setOccupancy(occRes.data as OccupancyReport)
    } catch {
      toastError('Error', 'Could not load rooms.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditingRoom(null)
    setForm({ ...BLANK_FORM })
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(room: HotelRoom) {
    setEditingRoom(room)
    setForm({
      roomNumber: room.roomNumber, roomType: room.roomType, floor: room.floor ?? '',
      maxOccupancy: String(room.maxOccupancy), baseRate: String(room.baseRate),
      amenities: room.amenities ?? '', notes: room.notes ?? '',
    })
    setFormError(null)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.roomNumber.trim() || !form.roomType.trim()) {
      setFormError('Room number and room type are required.')
      return
    }
    setSaving(true)
    setFormError(null)
    const payload = {
      roomType: form.roomType.trim(),
      floor: form.floor.trim() || undefined,
      maxOccupancy: form.maxOccupancy ? Number(form.maxOccupancy) : undefined,
      baseRate: form.baseRate ? Number(form.baseRate) : undefined,
      amenities: form.amenities.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }
    const res = editingRoom
      ? await api.hotel.updateRoom({ id: editingRoom.id, ...payload })
      : await api.hotel.createRoom({ roomNumber: form.roomNumber.trim(), ...payload })
    setSaving(false)
    if (res.success) {
      setShowForm(false)
      toastSuccess(editingRoom ? 'Room updated' : 'Room added', form.roomNumber)
      await load()
    } else {
      setFormError(res.error?.message ?? 'Could not save room.')
    }
  }

  async function handleStatusChange(room: HotelRoom, status: string) {
    const res = await api.hotel.updateRoom({ id: room.id, status: status as HotelRoom['status'] })
    if (res.success) await load()
    else toastError('Error', res.error?.message ?? 'Could not update room status.')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await api.hotel.deleteRoom({ id: deleteTarget.id })
    setDeleting(false)
    if (res.success) { setDeleteTarget(null); await load() }
    else toastError('Error', res.error?.message ?? 'Could not delete room.')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-slate-100">Rooms</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Room roster, rates, and housekeeping status</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-1.5" /> Add Room
          </Button>
        )}
      </div>

      {occupancy && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <KpiCard label="Total Rooms" value={String(occupancy.totalRooms)} icon={<BedDouble size={18} />} />
          <KpiCard label="Occupied" value={String(occupancy.occupied)} />
          <KpiCard label="Available" value={String(occupancy.available)} />
          <KpiCard label="Cleaning" value={String(occupancy.cleaning)} />
          <KpiCard label="Occupancy" value={`${occupancy.occupancyPercent}%`} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">No rooms added yet.</p>
        </div>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Room</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Floor</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Max Occupancy</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Rate / Night</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rooms.map((r) => (
                <tr key={r.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${!r.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-dark dark:text-slate-100 cursor-pointer" onClick={() => canManage && openEdit(r)}>{r.roomNumber}</td>
                  <td className="px-4 py-3">{r.roomType}</td>
                  <td className="px-4 py-3">{r.floor ?? '—'}</td>
                  <td className="px-4 py-3">{r.maxOccupancy}</td>
                  <td className="px-4 py-3">{formatCurrency(r.baseRate)}</td>
                  <td className="px-4 py-3">
                    {canManage && r.status !== 'OCCUPIED' ? (
                      <select value={r.status} onChange={(e) => handleStatusChange(r, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border-0 ${STATUS_COLORS[r.status]}`}>
                        <option value="AVAILABLE">Available</option>
                        <option value="CLEANING">Cleaning</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="OUT_OF_ORDER">Out of Order</option>
                      </select>
                    ) : (
                      <Badge variant={r.status === 'OCCUPIED' ? 'brand' : r.status === 'AVAILABLE' ? 'success' : 'neutral'}>{r.status.replace(/_/g, ' ')}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && r.status !== 'OCCUPIED' && (
                      <button onClick={() => setDeleteTarget(r)} className="text-slate-300 hover:text-danger"><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <p className="font-semibold text-dark dark:text-slate-100">{editingRoom ? 'Edit Room' : 'Add Room'}</p>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && <div className="bg-danger/10 text-danger text-sm rounded-lg px-3 py-2">{formError}</div>}
              <Input label="Room Number" value={form.roomNumber} disabled={!!editingRoom} onChange={(e) => setForm((f) => ({ ...f, roomNumber: e.target.value }))} placeholder="e.g. 101" />
              <Input label="Room Type" value={form.roomType} onChange={(e) => setForm((f) => ({ ...f, roomType: e.target.value }))} placeholder="e.g. Deluxe" />
              <Input label="Floor" value={form.floor} onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))} />
              <Input label="Max Occupancy" type="number" value={form.maxOccupancy} onChange={(e) => setForm((f) => ({ ...f, maxOccupancy: e.target.value }))} />
              <Input label="Rate / Night" type="number" value={form.baseRate} onChange={(e) => setForm((f) => ({ ...f, baseRate: e.target.value }))} />
              <Input label="Amenities" value={form.amenities} onChange={(e) => setForm((f) => ({ ...f, amenities: e.target.value }))} placeholder="e.g. AC, Wi-Fi, TV" />
              <Input label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? '…' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Room"
        message={`Delete room ${deleteTarget?.roomNumber}? This can only be done if it has no booking history.`}
        confirmLabel="Delete"
      />
    </div>
  )
}
