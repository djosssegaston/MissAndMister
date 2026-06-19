<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SocialProject extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'candidate1_id',
        'candidate2_id',
        'theme',
        'candidate1_photo_path',
        'candidate2_photo_path',
        'created_by',
    ];

    protected $appends = [
        'candidate1_photo_url',
        'candidate2_photo_url',
    ];

    public function getCandidate1PhotoUrlAttribute(): ?string
    {
        return \App\Support\MediaUrl::fromPath($this->candidate1_photo_path);
    }

    public function getCandidate2PhotoUrlAttribute(): ?string
    {
        return \App\Support\MediaUrl::fromPath($this->candidate2_photo_path);
    }

    public function candidate1()
    {
        return $this->belongsTo(Candidate::class, 'candidate1_id');
    }

    public function candidate2()
    {
        return $this->belongsTo(Candidate::class, 'candidate2_id');
    }

    public function creator()
    {
        return $this->belongsTo(Admin::class, 'created_by');
    }
}
