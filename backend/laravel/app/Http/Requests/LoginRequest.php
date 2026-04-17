<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // Login only needs an identifier string; avoiding strict email regex
            // keeps authentication stable on hosts with inconsistent PCRE behavior.
            'email' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'scope' => ['nullable', 'in:user,admin'],
        ];
    }
}
