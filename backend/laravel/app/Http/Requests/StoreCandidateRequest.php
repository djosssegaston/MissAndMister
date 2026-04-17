<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class StoreCandidateRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->tokenCan('admin') ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'category_id' => ['required', 'exists:categories,id'],
            'first_name' => ['required', 'string', 'max:120'],
            'last_name' => ['required', 'string', 'max:120'],
            'public_number' => ['nullable', 'integer', 'min:1', 'unique:candidates,public_number'],
            'email' => ['nullable', 'email', 'required_with:password', 'unique:candidates,email', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:20', 'unique:candidates,phone', 'unique:users,phone'],
            'password' => ['nullable', 'string', 'confirmed', Password::min(10)->letters()->mixedCase()->numbers()->symbols()],
            'bio' => ['nullable', 'string', 'max:1000'],
            'description' => ['required_without:bio', 'string', 'max:1000'],
            'city' => ['required', 'string', 'max:255'],
            'photo_path' => ['nullable', 'string'],
            'video_path' => ['nullable', 'string'],
            'age' => ['nullable', 'integer', 'min:16', 'max:50'],
            'university' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:active,inactive'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
