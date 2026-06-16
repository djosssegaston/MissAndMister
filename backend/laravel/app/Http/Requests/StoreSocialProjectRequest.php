<?php

namespace App\Http\Requests;

use App\Models\SocialProject;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSocialProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->tokenCan('admin') ?? false;
    }

    public function rules(): array
    {
        $projectId = $this->route('social_project')?->id;

        return [
            'name' => ['required', 'string', 'max:255'],
            'candidate1_id' => [
                'required',
                'integer',
                'exists:candidates,id',
                Rule::notIn([$this->input('candidate2_id')]),
                $this->candidateNotInOtherProject($this->input('candidate1_id'), $projectId),
            ],
            'candidate2_id' => [
                'required',
                'integer',
                'exists:candidates,id',
                Rule::notIn([$this->input('candidate1_id')]),
                $this->candidateNotInOtherProject($this->input('candidate2_id'), $projectId),
            ],
            'theme' => ['required', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Le nom du binôme est requis.',
            'name.max' => 'Le nom du binôme ne doit pas dépasser 255 caractères.',
            'candidate1_id.required' => 'Veuillez sélectionner le premier candidat.',
            'candidate1_id.exists' => 'Le premier candidat sélectionné n\'existe pas.',
            'candidate1_id.not_in' => 'Le candidat 1 et le candidat 2 doivent être différents.',
            'candidate2_id.required' => 'Veuillez sélectionner le second candidat.',
            'candidate2_id.exists' => 'Le second candidat sélectionné n\'existe pas.',
            'candidate2_id.not_in' => 'Le candidat 1 et le candidat 2 doivent être différents.',
            'theme.required' => 'Le thème du projet social est requis.',
        ];
    }

    private function candidateNotInOtherProject(int $candidateId, ?int $ignoreProjectId): callable
    {
        return function (string $attribute, mixed $value, \Closure $fail) use ($candidateId, $ignoreProjectId): void {
            $exists = SocialProject::query()
                ->when($ignoreProjectId, fn ($q) => $q->whereKeyNot($ignoreProjectId))
                ->where(function ($q) use ($candidateId) {
                    $q->where('candidate1_id', $candidateId)
                        ->orWhere('candidate2_id', $candidateId);
                })
                ->exists();

            if ($exists) {
                $fail('Ce candidat est déjà affecté à un autre binôme.');
            }
        };
    }
}
