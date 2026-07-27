<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JSeraiTemplate extends Model
{
    protected $fillable = [
        'name',
        'file_path',
        'mask_path',
        'is_active',
        'overlay_config',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'overlay_config' => 'array',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $template): void {
            if ($template->is_active) {
                static::where('id', '!=', $template->id)
                    ->where('is_active', true)
                    ->update(['is_active' => false]);
            }
        });

        static::created(function (self $template): void {
            if ($template->is_active) {
                static::where('id', '!=', $template->id)
                    ->where('is_active', true)
                    ->update(['is_active' => false]);
            }
        });
    }

    public function tickets()
    {
        return $this->hasMany(JSeraiTicket::class);
    }
}
