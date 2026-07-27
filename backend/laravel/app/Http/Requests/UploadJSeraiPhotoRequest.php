<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadJSeraiPhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:20480'],
        ];
    }

    public function messages(): array
    {
        return [
            'photo.required' => 'La photo est obligatoire.',
            'photo.image' => 'Le fichier doit être une image.',
            'photo.mimes' => 'Formats acceptés : JPG, JPEG, PNG, WebP.',
            'photo.max' => 'La photo ne doit pas dépasser 20 Mo.',
        ];
    }
}
