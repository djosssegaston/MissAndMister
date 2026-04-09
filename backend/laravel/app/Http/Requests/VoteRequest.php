<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class VoteRequest extends FormRequest
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
            'candidate_id' => ['required', 'exists:candidates,id'],
            'amount' => ['required', 'numeric', 'min:100'],
            'quantity' => ['sometimes', 'integer', 'min:1'],
            'currency' => ['sometimes', 'string', 'max:8'],
        ];
    }
}
