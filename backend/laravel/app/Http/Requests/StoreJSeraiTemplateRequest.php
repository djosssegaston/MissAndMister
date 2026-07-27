<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreJSeraiTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->tokenCan('admin') ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'template' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
            'mask' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
            'overlay_config' => ['nullable', 'json'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Le nom du template est obligatoire.',
            'template.required' => 'Le fichier template est obligatoire.',
            'template.image' => 'Le fichier doit être une image.',
        ];
    }
}
