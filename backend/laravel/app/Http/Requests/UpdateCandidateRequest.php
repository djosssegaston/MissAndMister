<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateCandidateRequest extends FormRequest
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
        $candidateId = $this->route('candidate')?->id ?? $this->route('id');
        $currentCategoryId = $this->route('candidate')?->category_id;
        $targetCategoryId = (int) ($this->input('category_id') ?? $currentCategoryId ?? 0);

        return [
            'category_id' => ['sometimes', 'exists:categories,id'],
            'first_name' => ['sometimes', 'string', 'max:120'],
            'last_name' => ['sometimes', 'string', 'max:120'],
            'public_number' => [
                'sometimes',
                'required',
                'integer',
                'min:1',
                Rule::unique('candidates', 'public_number')
                    ->ignore($candidateId)
                    ->where(fn ($query) => $query->where('category_id', $targetCategoryId)),
            ],
            'email' => ['sometimes', 'nullable', 'email', 'required_with:password', 'unique:candidates,email,' . $candidateId, 'unique:users,email,' . $candidateId . ',candidate_id'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20', 'unique:candidates,phone,' . $candidateId, 'unique:users,phone,' . $candidateId . ',candidate_id'],
            'password' => ['sometimes', 'nullable', 'string', 'confirmed', Password::min(10)->letters()->mixedCase()->numbers()->symbols()],
            'bio' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'city' => ['sometimes', 'string', 'max:255'],
            'photo_path' => ['sometimes', 'nullable', 'string'],
            'video_path' => ['sometimes', 'nullable', 'string'],
            'age' => ['sometimes', 'nullable', 'integer', 'min:16', 'max:50'],
            'university' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'in:active,inactive'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'public_number.unique' => "Ce numéro d'ordre est déjà utilisé dans cette catégorie.",
        ];
    }
}
