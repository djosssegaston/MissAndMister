<?php

namespace App\Models;

use App\Support\MediaUrl;
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
        return MediaUrl::fromPath($this->image_path);
    }
}
