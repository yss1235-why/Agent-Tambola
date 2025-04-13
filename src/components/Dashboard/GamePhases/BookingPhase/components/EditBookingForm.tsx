// src/components/Dashboard/GamePhases/BookingPhase/components/EditBookingForm.tsx
import { useState } from 'react';
import { Game } from '../../../../../types/game';

interface EditBookingFormProps {
  booking: Game.Booking & { ticketId: string };
  ticketId: string;
  onSubmit: (ticketId: string, data: { name: string; phone: string }) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

function EditBookingForm({
  booking,
  ticketId,
  onSubmit,
  onCancel,
  isSubmitting
}: EditBookingFormProps) {
  const [formData, setFormData] = useState({
    name: booking.playerName,
    phone: booking.phoneNumber
  });
  const [errors, setErrors] = useState({
    name: '',
    phone: ''
  });

  const validateForm = (): boolean => {
    const newErrors = {
      name: '',
      phone: ''
    };

    if (!formData.name.trim()) {
      newErrors.name = 'Player name is required';
    }

    const phonePattern = /^[0-9]{10}$/;
    if (!phonePattern.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }

    setErrors(newErrors);
    return !newErrors.name && !newErrors.phone;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await onSubmit(ticketId, formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded-lg">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Player Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm
            focus:border-blue-500 focus:ring-blue-500 sm:text-sm
            ${errors.name ? 'border-red-300' : ''}`}
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Phone Number
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            phone: e.target.value.replace(/\D/g, '').slice(0, 10)
          }))}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm
            focus:border-blue-500 focus:ring-blue-500 sm:text-sm
            ${errors.phone ? 'border-red-300' : ''}`}
          disabled={isSubmitting}
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
        )}
      </div>

      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white 
            border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-3 py-2 text-sm font-medium text-white bg-blue-600 
            rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

export default EditBookingForm;