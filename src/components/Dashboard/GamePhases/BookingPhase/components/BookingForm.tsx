// src/components/Dashboard/GamePhases/BookingPhase/components/BookingForm.tsx - CLEAN VERSION
// Removed instructional content

import { useState, useEffect } from 'react';

interface BookingFormProps {
  selectedCount: number;
  isSubmitting: boolean;
  onSubmit: (data: { name: string; phone: string }) => Promise<void>;
}

function BookingForm({ selectedCount, isSubmitting, onSubmit }: BookingFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: ''
  });
  const [errors, setErrors] = useState({
    name: '',
    phone: ''
  });

  useEffect(() => {
    if (selectedCount === 0) {
      setErrors({
        name: '',
        phone: ''
      });
    }
  }, [selectedCount]);

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

    if (!selectedCount) {
      setErrors(prev => ({
        ...prev,
        name: 'Please select at least one ticket'
      }));
      return;
    }

    if (!validateForm()) return;

    try {
      await onSubmit(formData);
      setFormData({
        name: '',
        phone: ''
      });
    } catch (error) {
      console.error('Error submitting booking:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="space-y-2 mb-6">
        <h3 className="text-lg font-medium text-gray-900">Book Tickets</h3>
        <p className="text-sm text-gray-600">
          {selectedCount === 0 
            ? 'Select tickets to book'
            : `${selectedCount} ticket${selectedCount !== 1 ? 's' : ''} selected`}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="playerName" 
            className="block text-sm font-medium text-gray-700"
          >
            Player Name
          </label>
          <div className="mt-1">
            <input
              type="text"
              id="playerName"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                name: e.target.value
              }))}
              className={`block w-full px-3 py-2 border rounded-md shadow-sm 
                focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                ${errors.name ? 'border-red-300' : 'border-gray-300'}`}
              disabled={isSubmitting || selectedCount === 0}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>
        </div>

        <div>
          <label 
            htmlFor="phoneNumber" 
            className="block text-sm font-medium text-gray-700"
          >
            Phone Number
          </label>
          <div className="mt-1">
            <input
              type="tel"
              id="phoneNumber"
              name="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                phone: e.target.value.replace(/\D/g, '').slice(0, 10)
              }))}
              className={`block w-full px-3 py-2 border rounded-md shadow-sm 
                focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                ${errors.phone ? 'border-red-300' : 'border-gray-300'}`}
              placeholder="10-digit number"
              disabled={isSubmitting || selectedCount === 0}
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || selectedCount === 0}
          className={`w-full px-4 py-2 text-sm font-medium rounded-md shadow-sm
            text-white bg-blue-600 hover:bg-blue-700 focus:outline-none 
            focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            ${(isSubmitting || selectedCount === 0) 
              ? 'opacity-50 cursor-not-allowed' 
              : ''}`}
        >
          {isSubmitting 
            ? 'Processing...' 
            : selectedCount === 0 
              ? 'Select Tickets to Book' 
              : 'Book Selected Tickets'}
        </button>
      </form>
    </div>
  );
}

export default BookingForm;
