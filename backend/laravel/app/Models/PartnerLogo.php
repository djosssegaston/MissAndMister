<?php

namespace App\Models;

use App\Support\MediaUrl;
use Illuminate\Database\Eloquent\Model;

class PartnerLogo extends Model
{
    protected $fillable = [
        'name',
        'website_url',
        'logo_path',
        'logo_meta',
        'sort_order',
        'is_active',
        'published_at',
    ];

    protected $casts = [
        'logo_meta' => 'array',
        'is_active' => 'boolean',
        'published_at' => 'datetime',
    ];

    protected $appends = [
        'logo_url',
    ];

    public function getLogoUrlAttribute(): ?string
    {
        return MediaUrl::fromPath($this->logo_path);
    }
}
