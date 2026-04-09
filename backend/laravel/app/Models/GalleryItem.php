<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GalleryItem extends Model
{
    protected $fillable = [
        'title',
        'caption',
        'category',
        'alt_text',
        'image_path',
        'image_meta',
        'layout_span',
        'sort_order',
        'is_published',
        'published_at',
    ];

    protected $casts = [
        'image_meta' => 'array',
        'is_published' => 'boolean',
        'published_at' => 'datetime',
    ];

    protected $appends = [
        'image_url',
    ];

    public function getImageUrlAttribute(): ?string
    {
        return $this->buildPublicUrl($this->image_path);
    }

    private function buildPublicUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        if (str_starts_with($path, 'http')) {
            return $path;
        }

        if (str_starts_with($path, '/storage')) {
            return url($path);
        }

        return asset('storage/' . ltrim($path, '/'));
    }
}
